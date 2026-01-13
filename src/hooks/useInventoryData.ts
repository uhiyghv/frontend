// hooks/useInventoryData.ts
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/backend/client";
import { toast } from "sonner";
import { isBefore } from "date-fns";

interface Product {
  id: string;
  name: string | null;
  barcode: string | null;
  category: string | null;
  created_at: string;
  image_url?: string | null;
  brand?: string | null;
  origin?: string | null;
  nutriscore?: string | null;
  ecoscore?: string | null;
  nova_group?: number | null;
}

export interface ProductWithDetails extends Product {
  totalQuantity: number;
  dispensaNames: string[];
  dispensaProducts: { id: string; dispensa_id: string; quantity: number; expiry_date: string | null }[];
  allCategories: string[];
  nearestExpiry: string | null;
  displayQuantity: number;
}

export interface Dispensa {
  id: string;
  name: string;
}

export function useInventoryData(userId: string | undefined, groupId: string | undefined) {
  const [products, setProducts] = useState<ProductWithDetails[]>([]);
  const [dispense, setDispense] = useState<Dispensa[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    if (!groupId || !userId) return;
    
    try {
      setIsLoading(true);

      // Fetch products for the active group
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });

      if (productsError) throw productsError;

      // Also fetch products without group_id but owned by user (legacy)
      const { data: legacyProducts } = await supabase
        .from("products")
        .select("*")
        .eq("user_id", userId)
        .is("group_id", null)
        .order("created_at", { ascending: false });

      const allProducts = [...(productsData || []), ...(legacyProducts || [])];

      const { data: dispenseData } = await supabase
        .from("dispense")
        .select("id, name")
        .eq("group_id", groupId);
      
      const { data: dispenseProductsData } = await supabase
        .from("dispense_products")
        .select("id, product_id, quantity, dispensa_id, expiry_date, dispense:dispensa_id(name)");

      const { data: allCategoriesData } = await supabase
        .from("product_categories")
        .select("product_id, category_name");

      // Build maps
      const productDispenseMap: Record<string, { 
        total: number; 
        names: string[]; 
        products: { id: string; dispensa_id: string; quantity: number; expiry_date: string | null }[];
        nearestExpiry: string | null;
      }> = {};
      
      (dispenseProductsData || []).forEach((dp: any) => {
        if (!productDispenseMap[dp.product_id]) {
          productDispenseMap[dp.product_id] = { total: 0, names: [], products: [], nearestExpiry: null };
        }
        productDispenseMap[dp.product_id].total += dp.quantity;
        productDispenseMap[dp.product_id].products.push({
          id: dp.id,
          dispensa_id: dp.dispensa_id,
          quantity: dp.quantity,
          expiry_date: dp.expiry_date,
        });
        if (dp.dispense?.name && !productDispenseMap[dp.product_id].names.includes(dp.dispense.name)) {
          productDispenseMap[dp.product_id].names.push(dp.dispense.name);
        }
        if (dp.expiry_date) {
          const current = productDispenseMap[dp.product_id].nearestExpiry;
          if (!current || isBefore(new Date(dp.expiry_date), new Date(current))) {
            productDispenseMap[dp.product_id].nearestExpiry = dp.expiry_date;
          }
        }
      });

      const productCategoriesMap: Record<string, string[]> = {};
      (allCategoriesData || []).forEach((cat: { product_id: string; category_name: string }) => {
        if (!productCategoriesMap[cat.product_id]) productCategoriesMap[cat.product_id] = [];
        productCategoriesMap[cat.product_id].push(cat.category_name);
      });

      const productsWithDetails: ProductWithDetails[] = allProducts.map((p) => {
        const totalQty = productDispenseMap[p.id]?.total || 0;
        const hasDispensa = (productDispenseMap[p.id]?.products?.length || 0) > 0;
        return {
          ...p,
          totalQuantity: totalQty,
          dispensaNames: productDispenseMap[p.id]?.names || [],
          dispensaProducts: productDispenseMap[p.id]?.products || [],
          allCategories: productCategoriesMap[p.id] || (p.category ? [p.category] : []),
          nearestExpiry: productDispenseMap[p.id]?.nearestExpiry || null,
          displayQuantity: hasDispensa ? totalQty : 1,
        };
      });

      setProducts(productsWithDetails);
      setDispense(dispenseData || []);

      const allCats = new Set<string>();
      const allBrands = new Set<string>();
      (allCategoriesData || []).forEach((cat: { category_name: string }) => allCats.add(cat.category_name));
      allProducts.forEach((p) => { 
        if (p.category) allCats.add(p.category);
        if (p.brand) allBrands.add(p.brand);
      });
      setCategories(Array.from(allCats).sort());
      setBrands(Array.from(allBrands).sort());
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Errore nel caricamento dei prodotti");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userId && groupId) {
      fetchData();
    }
  }, [userId, groupId]);

  return {
    products,
    setProducts,
    dispense,
    categories,
    brands,
    isLoading,
    refetch: fetchData,
  };
}