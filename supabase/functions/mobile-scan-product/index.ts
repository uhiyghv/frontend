import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ScanRequest {
  barcode: string;
  dispensa_id: string;
  action?: "add" | "remove";
  quantity?: number;
}

// ─── Validators ────────────────────────────────────────────────────────────────
const validateBarcode = (b: string) => /^[A-Za-z0-9\-_.]{4,48}$/.test(b);
const isNumericBarcode = (b: string) => /^\d{8,14}$/.test(b);
const validateQuantity = (q: unknown): q is number =>
  typeof q === "number" && Number.isInteger(q) && q >= 1 && q <= 1000;

// ─── Helpers ───────────────────────────────────────────────────────────────────
const cleanCategory = (cat: string) => cat.replace(/^[a-z]{2}:/, "").trim();

function json(d: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(d), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── OpenFoodFacts ─────────────────────────────────────────────────────────────
async function fetchOpenFoodFactsData(barcode: string) {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
      { headers: { "User-Agent": "PantryApp/1.0" } },
    );
    if (!res.ok) return null;

    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;

    const p = data.product;
    const categoriesTags: string[] = (p.categories_tags ?? []).map(
      cleanCategory,
    );
    const mainCategory =
      categoriesTags[0] || p.categories?.split(",")[0]?.trim() || null;

    return {
      name:
        p.product_name_it ||
        p.product_name_en ||
        p.product_name ||
        "Prodotto Sconosciuto",
      brand: p.brands?.split(",")[0]?.trim() || null,
      category: mainCategory,
      image_url: p.image_front_url || p.image_url || null,
      ingredients: p.ingredients_text_it || p.ingredients_text || null,
      nutriscore: p.nutriscore_grade || null,
      ecoscore: p.ecoscore_grade || null,
      nova_group: p.nova_group ? Number(p.nova_group) : null,
      allergens: p.allergens || null,
      nutritional_values: p.nutriments
        ? {
            energyKcal: p.nutriments["energy-kcal_100g"] ?? null,
            fat: p.nutriments["fat_100g"] ?? null,
            saturatedFat: p.nutriments["saturated-fat_100g"] ?? null,
            carbohydrates: p.nutriments["carbohydrates_100g"] ?? null,
            sugars: p.nutriments["sugars_100g"] ?? null,
            proteins: p.nutriments["proteins_100g"] ?? null,
            salt: p.nutriments["salt_100g"] ?? null,
            fiber: p.nutriments["fiber_100g"] ?? null,
          }
        : null,
      packaging: p.packaging || null,
      labels: p.labels || null,
      origin: p.origins || p.countries || null,
      categories_list: categoriesTags.slice(0, 10),
    };
  } catch (e) {
    console.error("[OFF] Fetch error:", e);
    return null;
  }
}

// ─── Main Handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader)
      return json({ error: "Missing Authorization header" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // User client – respects RLS, used only to verify identity
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();

    if (userErr || !user) {
      console.error("[Auth] Failed:", userErr);
      return json({ error: "Unauthorized" }, 401);
    }

    // Admin client – bypasses RLS for trusted server-side operations
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // ── Parse & Validate Body ─────────────────────────────────────────────────
    let body: ScanRequest;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const { barcode, dispensa_id, action = "add", quantity = 1 } = body;

    const trimmed = (barcode ?? "").toString().trim();
    if (!trimmed || !validateBarcode(trimmed)) {
      return json({ error: "Codice a barre non valido" }, 400);
    }
    if (!dispensa_id || typeof dispensa_id !== "string") {
      return json({ error: "dispensa_id mancante" }, 400);
    }
    if (!["add", "remove"].includes(action)) {
      return json({ error: "Azione non valida (usa 'add' o 'remove')" }, 400);
    }
    if (!validateQuantity(quantity)) {
      return json({ error: "Quantità non valida (1–1000)" }, 400);
    }

    // ── 1. Verifica dispensa ──────────────────────────────────────────────────
    const { data: dispensa, error: dErr } = await admin
      .from("dispense")
      .select("id, name, group_id, user_id")
      .eq("id", dispensa_id)
      .maybeSingle();

    if (dErr) {
      console.error("[Dispensa] DB error:", dErr);
      return json({ error: "Errore recupero dispensa" }, 500);
    }
    if (!dispensa) {
      return json({ error: "Dispensa non trovata" }, 404);
    }

    // ── 2. Verifica permessi ──────────────────────────────────────────────────
    // Case A: the authenticated user owns the dispensa directly
    let allowed = dispensa.user_id === user.id;

    // Case B: the dispensa belongs to a group the user is a member of
    if (!allowed && dispensa.group_id) {
      const { data: membership, error: mErr } = await admin
        .from("group_members")
        .select("role, accepted_at")
        .eq("group_id", dispensa.group_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (mErr) {
        console.error("[Membership] DB error:", mErr);
        // Don't leak internal errors – treat as not allowed
      }

      if (membership) {
        // Allow any accepted member (viewer, editor, admin) to scan
        // Restrict to editors/admins only if you want stricter control
        const accepted = membership.accepted_at !== null;
        const validRole = ["viewer", "editor", "admin"].includes(
          membership.role,
        );
        allowed = accepted && validRole;

        console.log("[Permission] Group membership:", {
          user_id: user.id,
          group_id: dispensa.group_id,
          role: membership.role,
          accepted,
          allowed,
        });
      } else {
        console.log("[Permission] No membership found:", {
          user_id: user.id,
          group_id: dispensa.group_id,
        });
      }
    }

    if (!allowed) {
      console.warn("[Permission] Denied:", {
        user_id: user.id,
        dispensa_id,
        dispensa_user_id: dispensa.user_id,
        group_id: dispensa.group_id,
      });
      return json({ error: "Permesso negato per questa dispensa" }, 403);
    }

    // ── 3. Trova o crea prodotto ──────────────────────────────────────────────
    // Search scope: products owned by dispensa's owner OR shared in the group
    let productQuery = admin
      .from("products")
      .select("id, name, image_url, brand")
      .eq("barcode", trimmed);

    if (dispensa.group_id) {
      productQuery = productQuery.or(
        `user_id.eq.${dispensa.user_id},group_id.eq.${dispensa.group_id}`,
      );
    } else {
      productQuery = productQuery.eq("user_id", dispensa.user_id);
    }

    const { data: existing, error: pFindErr } =
      await productQuery.maybeSingle();

    if (pFindErr) {
      console.error("[Product] Find error:", pFindErr);
      return json({ error: "Errore ricerca prodotto" }, 500);
    }

    let productId: string;
    let productName: string;
    let productImage: string | null;
    let productBrand: string | null;

    if (existing) {
      productId = existing.id;
      productName = existing.name;
      productImage = existing.image_url;
      productBrand = existing.brand;
      console.log("[Product] Found existing:", productId, productName);
    } else {
      // Fetch from OpenFoodFacts only for numeric (EAN/UPC) barcodes
      const off = isNumericBarcode(trimmed)
        ? await fetchOpenFoodFactsData(trimmed)
        : null;

      const { data: created, error: pErr } = await admin
        .from("products")
        .insert({
          barcode: trimmed,
          user_id: dispensa.user_id,
          group_id: dispensa.group_id,
          name: off?.name ?? "Prodotto Scansionato",
          brand: off?.brand ?? null,
          category: off?.category ?? null,
          image_url: off?.image_url ?? null,
          ingredients: off?.ingredients ?? null,
          nutriscore: off?.nutriscore ?? null,
          ecoscore: off?.ecoscore ?? null,
          nova_group: off?.nova_group ?? null,
          allergens: off?.allergens ?? null,
          nutritional_values: off?.nutritional_values ?? null,
          packaging: off?.packaging ?? null,
          labels: off?.labels ?? null,
          origin: off?.origin ?? null,
          categories_list: off?.categories_list ?? null,
        })
        .select("id, name, image_url, brand")
        .single();

      if (pErr) {
        console.error("[Product] Insert error:", pErr);
        return json({ error: "Errore creazione prodotto" }, 500);
      }

      productId = created.id;
      productName = created.name;
      productImage = created.image_url;
      productBrand = created.brand;
      console.log("[Product] Created:", productId, productName);
    }

    // ── 4. Aggiorna quantità nella dispensa ───────────────────────────────────
    const { data: curRow, error: curErr } = await admin
      .from("dispense_products")
      .select("quantity")
      .eq("dispensa_id", dispensa_id)
      .eq("product_id", productId)
      .maybeSingle();

    if (curErr) {
      console.error("[Quantity] Fetch error:", curErr);
      return json({ error: "Errore recupero quantità attuale" }, 500);
    }

    const currentQty: number = curRow?.quantity ?? 0;
    const newQty =
      action === "add"
        ? currentQty + quantity
        : Math.max(0, currentQty - quantity);

    const { error: upsertErr } = await admin.from("dispense_products").upsert(
      {
        dispensa_id,
        product_id: productId,
        quantity: newQty,
        last_scanned_at: new Date().toISOString(),
      },
      { onConflict: "dispensa_id,product_id" },
    );

    if (upsertErr) {
      console.error("[Quantity] Upsert error:", upsertErr);
      return json({ error: "Errore aggiornamento quantità" }, 500);
    }

    // ── 5. Notifica (best-effort, non blocca la risposta) ─────────────────────
    admin
      .from("notifications")
      .insert({
        user_id: user.id,
        title: action === "add" ? "Prodotto aggiunto" : "Prodotto rimosso",
        message: `${quantity}x ${productName} ${
          action === "add" ? "aggiunto a" : "rimosso da"
        } ${dispensa.name}`,
        type: "scanner",
      })
      .then(({ error: nErr }) => {
        if (nErr) console.error("[Notification] Insert error:", nErr);
      });

    // ── 6. Risposta ───────────────────────────────────────────────────────────
    console.log("[Done]", {
      user_id: user.id,
      barcode: trimmed,
      action,
      quantity,
      newQty,
      productName,
    });

    return json({
      success: true,
      productId,
      productName,
      productImage,
      productBrand,
      newQuantity: newQty,
      action,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Function] Unhandled error:", message);
    return json({ error: "Errore interno del server", details: message }, 500);
  }
});
