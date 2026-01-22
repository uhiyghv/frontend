import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ScanRequest {
  barcode: string;
  scanner_serial: string;
  action?: "add" | "remove";
  quantity?: number;
}

// Input validation
function validateBarcode(barcode: string): boolean {
  // Allow EAN-8, EAN-13, UPC-A, UPC-E formats (numeric, 8-13 digits)
  return /^\d{8,13}$/.test(barcode);
}

function validateQuantity(quantity: number): boolean {
  return Number.isInteger(quantity) && quantity >= 1 && quantity <= 1000;
}

function validateSerialNumber(serial: string): boolean {
  // Format: SCN-XXXXXXXX-XXXX
  return /^SCN-[A-Z0-9]{8}-[A-Z0-9]{4}$/.test(serial);
}

const cleanCategory = (cat: string): string =>
  cat.replace(/^[a-z]{2}:/, "").trim();

// Unified product data fetching from OpenFoodFacts
async function fetchOpenFoodFactsData(barcode: string) {
  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
    );
    const data = await response.json();
    if (data.status !== 1 || !data.product) return null;

    const p = data.product;

    // Estrazione categorie pulite (stessa logica del frontend)
    const categoriesTags = p.categories_tags?.map(cleanCategory) || [];
    const mainCategory =
      categoriesTags[0] || p.categories?.split(",")[0]?.trim() || null;

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
      // Mappatura Nutriments precisa
      nutritional_values: p.nutriments
        ? {
            energyKcal: p.nutriments["energy-kcal_100g"] ?? null,
            fat: p.nutriments.fat_100g ?? p.nutriments.fat ?? null,
            saturatedFat:
              p.nutriments["saturated-fat_100g"] ??
              p.nutriments.saturated_fat ??
              null,
            carbohydrates:
              p.nutriments.carbohydrates_100g ??
              p.nutriments.carbohydrates ??
              null,
            sugars: p.nutriments.sugars_100g ?? p.nutriments.sugars ?? null,
            proteins:
              p.nutriments.proteins_100g ?? p.nutriments.proteins ?? null,
            salt: p.nutriments.salt_100g ?? p.nutriments.salt ?? null,
            fiber: p.nutriments.fiber_100g ?? p.nutriments.fiber ?? null,
            sodium: p.nutriments.sodium_100g ?? null,
          }
        : null,
      packaging: p.packaging || null,
      labels: p.labels || null,
      origin: p.origins || p.countries || null,
      // Mappatura Carbon Footprint (Agribalyse)
      carbon_footprint: p.ecoscore_data?.agribalyse
        ? {
            total: p.ecoscore_data.agribalyse.co2_total ?? null,
            agriculture: p.ecoscore_data.agribalyse.co2_agriculture ?? null,
            packaging: p.ecoscore_data.agribalyse.co2_packaging ?? null,
            transportation:
              p.ecoscore_data.agribalyse.co2_transportation ?? null,
            distribution: p.ecoscore_data.agribalyse.co2_distribution ?? null,
            processing: p.ecoscore_data.agribalyse.co2_processing ?? null,
          }
        : null,
      categories_list: categoriesTags.slice(0, 10),
    };
  } catch (err) {
    console.error("OFF Fetch error:", err);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  const jsonResponse = (data: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // 1. Auth & Client Setup
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer "))
      return jsonResponse({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    /*     const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401); */

    // 2. Parse Body & Validate Inputs
    const {
      barcode,
      scanner_serial,
      action = "add",
      quantity = 1,
    }: ScanRequest = await req.json();

    // Input validation
    if (!barcode || !validateBarcode(barcode)) {
      return jsonResponse(
        { error: "Invalid barcode format. Must be 8-13 digits." },
        400,
      );
    }
    if (!scanner_serial || !validateSerialNumber(scanner_serial)) {
      return jsonResponse(
        { error: "Invalid scanner serial format. Must be SCN-XXXXXXXX-XXXX." },
        400,
      );
    }
    if (!validateQuantity(quantity)) {
      return jsonResponse(
        { error: "Invalid quantity. Must be an integer between 1 and 1000." },
        400,
      );
    }
    if (!["add", "remove"].includes(action)) {
      return jsonResponse(
        { error: 'Invalid action. Must be "add" or "remove".' },
        400,
      );
    }

    // 3. Scanner Check
    const { data: scanner, error: scannerError } = await supabase
      .from("scanners")
      .select("id, user_id, dispensa_id, dispense(name)")
      .eq("serial_number", scanner_serial)
      .maybeSingle();

    if (!scanner) return jsonResponse({ error: "Scanner non trovato" }, 404);

    const userId = scanner.user_id;

    // AGGIORNAMENTO: Aggiungi await per evitare l'EarlyDrop
    await supabase
      .from("scanners")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", scanner.id);

    // 4. Product Logic
    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let productId: string;
    let productName: string;

    const { data: existingProduct } = await serviceSupabase
      .from("products")
      .select("id, name")
      .eq("barcode", barcode)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingProduct) {
      productId = existingProduct.id;
      productName = existingProduct.name || "Prodotto senza nome";
    } else {
      const offData = await fetchOpenFoodFactsData(barcode);

      const { data: newProduct, error: pError } = await serviceSupabase
        .from("products")
        .insert({
          barcode,
          user_id: userId,
          name: offData?.name || "Nuovo Prodotto",
          brand: offData?.brand,
          category: offData?.category,
          image_url: offData?.image_url,
          ingredients: offData?.ingredients,
          nutriscore: offData?.nutriscore,
          ecoscore: offData?.ecoscore,
          nova_group: offData?.nova_group,
          allergens: offData?.allergens,
          nutritional_values: offData?.nutritional_values,
          packaging: offData?.packaging,
          labels: offData?.labels,
          origin: offData?.origin,
          carbon_footprint: offData?.carbon_footprint,
        })
        .select("id, name")
        .single();

      if (pError) throw pError;
      productId = newProduct.id;
      productName = newProduct.name;

      // FIX CATEGORIE: Usa categories_list come definito in fetchOpenFoodFactsData
      if (offData?.categories_list?.length) {
        const cats = offData.categories_list.map((cat: string) => ({
          product_id: productId,
          category_name: cat,
        }));
        await serviceSupabase.from("product_categories").insert(cats); // Aggiunto await
      }
    }

    // 5. Quantity UPSERT (Con Await)
    if (scanner.dispensa_id) {
      const { data: currentEntry } = await serviceSupabase
        .from("dispense_products")
        .select("quantity")
        .eq("dispensa_id", scanner.dispensa_id)
        .eq("product_id", productId)
        .maybeSingle();

      const newQty =
        action === "add"
          ? (currentEntry?.quantity || 0) + quantity
          : Math.max(0, (currentEntry?.quantity || 0) - quantity);

      await serviceSupabase.from("dispense_products").upsert(
        {
          dispensa_id: scanner.dispensa_id,
          product_id: productId,
          quantity: newQty,
          last_scanned_at: new Date().toISOString(),
        },
        { onConflict: "dispensa_id,product_id" },
      );
    }

    // 6. Final Logs (Con Await)
    const dispenseData = scanner.dispense as
      | { name: string }
      | { name: string }[]
      | null;
    const locationName = Array.isArray(dispenseData)
      ? dispenseData[0]?.name
      : dispenseData?.name || "dispensa";

    await Promise.all([
      serviceSupabase.from("scan_logs").insert({
        scanner_id: scanner.id,
        dispensa_id: scanner.dispensa_id,
        product_id: productId,
        barcode,
        action,
        quantity,
      }),
      serviceSupabase.from("notifications").insert({
        user_id: userId,
        title: action === "add" ? "Prodotto aggiunto" : "Prodotto rimosso",
        message: `${quantity}x ${productName} ${action === "add" ? "aggiunto a" : "rimosso da"} ${locationName}`,
        type: "scanner",
      }),
    ]);

    return jsonResponse({ success: true, productId, productName });
  } catch (error: unknown) {
    console.error("Critical Error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
