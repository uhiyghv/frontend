import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScanRequest {
  barcode: string;
  dispensa_id: string;
  action?: "add" | "remove";
  quantity?: number;
}

const validateBarcode = (b: string) => /^[A-Za-z0-9\-_.]{4,48}$/.test(b);
const isNumericBarcode = (b: string) => /^\d{8,14}$/.test(b);
const validateQuantity = (q: number) => Number.isInteger(q) && q >= 1 && q <= 1000;
const cleanCategory = (cat: string) => cat.replace(/^[a-z]{2}:/, "").trim();

async function fetchOpenFoodFactsData(barcode: string) {
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
    const data = await r.json();
    if (data.status !== 1 || !data.product) return null;
    const p = data.product;
    const categoriesTags = p.categories_tags?.map(cleanCategory) || [];
    const mainCategory = categoriesTags[0] || p.categories?.split(",")[0]?.trim() || null;
    return {
      name: p.product_name || p.product_name_it || null,
      brand: p.brands || null,
      category: mainCategory,
      image_url: p.image_front_url || p.image_url || null,
      ingredients: p.ingredients_text_it || p.ingredients_text || null,
      nutriscore: p.nutriscore_grade || null,
      ecoscore: p.ecoscore_grade || null,
      nova_group: p.nova_group || null,
      allergens: p.allergens || null,
      nutritional_values: p.nutriments
        ? {
            energyKcal: p.nutriments["energy-kcal_100g"] ?? null,
            fat: p.nutriments.fat_100g ?? null,
            saturatedFat: p.nutriments["saturated-fat_100g"] ?? null,
            carbohydrates: p.nutriments.carbohydrates_100g ?? null,
            sugars: p.nutriments.sugars_100g ?? null,
            proteins: p.nutriments.proteins_100g ?? null,
            salt: p.nutriments.salt_100g ?? null,
            fiber: p.nutriments.fiber_100g ?? null,
            sodium: p.nutriments.sodium_100g ?? null,
          }
        : null,
      packaging: p.packaging || null,
      labels: p.labels || null,
      origin: p.origins || p.countries || null,
      categories_list: categoriesTags.slice(0, 10),
    };
  } catch (e) {
    console.error("OFF error:", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (d: Record<string, unknown>, s = 200) =>
    new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const { barcode, dispensa_id, action = "add", quantity = 1 }: ScanRequest = await req.json();

    if (!barcode || !validateBarcode(barcode)) return json({ error: "Codice a barre non valido (8-13 cifre)" }, 400);
    if (!dispensa_id || typeof dispensa_id !== "string") return json({ error: "Dispensa richiesta" }, 400);
    if (!validateQuantity(quantity)) return json({ error: "Quantità non valida (1-1000)" }, 400);
    if (!["add", "remove"].includes(action)) return json({ error: "Azione non valida" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: dispensa } = await admin
      .from("dispense")
      .select("id, name, group_id, user_id")
      .eq("id", dispensa_id)
      .maybeSingle();
    if (!dispensa) return json({ error: "Dispensa non trovata" }, 404);

    let allowed = dispensa.user_id === userId;
    if (!allowed && dispensa.group_id) {
      const { data: membership } = await admin
        .from("group_members")
        .select("role, accepted_at")
        .eq("group_id", dispensa.group_id)
        .eq("user_id", userId)
        .not("accepted_at", "is", null)
        .maybeSingle();
      if (membership && ["editor", "admin"].includes(membership.role)) allowed = true;
    }
    if (!allowed) return json({ error: "Permesso negato" }, 403);

    const ownerId = dispensa.user_id;
    let productId: string;
    let productName: string;

    const { data: existing } = await admin
      .from("products")
      .select("id, name")
      .eq("barcode", barcode)
      .eq("user_id", ownerId)
      .maybeSingle();

    if (existing) {
      productId = existing.id;
      productName = existing.name || "Prodotto senza nome";
    } else {
      const off = await fetchOpenFoodFactsData(barcode);
      const { data: created, error: pErr } = await admin
        .from("products")
        .insert({
          barcode,
          user_id: ownerId,
          group_id: dispensa.group_id,
          name: off?.name || "Nuovo Prodotto",
          brand: off?.brand,
          category: off?.category,
          image_url: off?.image_url,
          ingredients: off?.ingredients,
          nutriscore: off?.nutriscore,
          ecoscore: off?.ecoscore,
          nova_group: off?.nova_group,
          allergens: off?.allergens,
          nutritional_values: off?.nutritional_values,
          packaging: off?.packaging,
          labels: off?.labels,
          origin: off?.origin,
        })
        .select("id, name")
        .single();
      if (pErr) throw pErr;
      productId = created.id;
      productName = created.name;
      if (off?.categories_list?.length) {
        await admin.from("product_categories").insert(
          off.categories_list.map((c: string) => ({ product_id: productId, category_name: c })),
        );
      }
    }

    const { data: cur } = await admin
      .from("dispense_products")
      .select("quantity")
      .eq("dispensa_id", dispensa_id)
      .eq("product_id", productId)
      .maybeSingle();

    const newQty = action === "add"
      ? (cur?.quantity || 0) + quantity
      : Math.max(0, (cur?.quantity || 0) - quantity);

    await admin.from("dispense_products").upsert(
      {
        dispensa_id,
        product_id: productId,
        quantity: newQty,
        last_scanned_at: new Date().toISOString(),
      },
      { onConflict: "dispensa_id,product_id" },
    );

    await admin.from("notifications").insert({
      user_id: userId,
      title: action === "add" ? "Prodotto aggiunto" : "Prodotto rimosso",
      message: `${quantity}x ${productName} ${action === "add" ? "aggiunto a" : "rimosso da"} ${dispensa.name}`,
      type: "scanner",
    });

    return json({ success: true, productId, productName, newQuantity: newQty });
  } catch (err) {
    console.error("mobile-scan-product error:", err);
    return json({ error: "Errore interno del server" }, 500);
  }
});
