// hooks/useProductActions.ts
import { useState } from "react";
import { supabase } from "@/integrations/backend/client";
import { toast } from "sonner";
import { useProductInfo } from "@/hooks/useProductInfo";
import { format } from "date-fns";
import type { ProductWithDetails } from "./useInventoryData";

interface NewProductData {
  name: string;
  barcode: string;
  category: string;
  quantity: number;
  dispensa_id: string;
}

export function useProductActions(
  userId: string | undefined,
  groupId: string | undefined,
  refetch: () => void,
  addLocalNotification: (title: string, message: string, type: string) => void
) {
  const { fetchProductInfo } = useProductInfo();
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Aggiunge un nuovo prodotto all'inventario
   * - Valida i dati inseriti
   * - Recupera info da Open Food Facts tramite barcode
   * - Inserisce il prodotto nel database
   * - Aggiunge le categorie associate
   * - Se specificata, aggiunge il prodotto alla dispensa con quantità e scadenza
   */
  const addProduct = async (newProduct: NewProductData, expiryDate?: Date) => {
    // Validazione
    if (!userId || !groupId || !newProduct.barcode.trim() || !/^\d+$/.test(newProduct.barcode.trim()) || newProduct.quantity < 1) {
      toast.error("Compila correttamente tutti i campi obbligatori");
      return false;
    }

    setIsSubmitting(true);
    try {
      // Fetch info prodotto da Open Food Facts
      const productInfo = await fetchProductInfo(newProduct.barcode.trim());
      const productName = newProduct.name.trim() || productInfo?.name || null;
      const productCategory = newProduct.category.trim() || productInfo?.category || null;

      // Inserisci prodotto
      const { data: insertedProduct, error } = await supabase
        .from("products")
        .insert({
          user_id: userId,
          group_id: groupId,
          name: productName,
          barcode: newProduct.barcode.trim(),
          category: productCategory,
          image_url: productInfo?.imageUrl || null,
          brand: productInfo?.brand || null,
          ingredients: productInfo?.ingredients || null,
          nutriscore: productInfo?.nutriscoreGrade || null,
          ecoscore: productInfo?.ecoscoreGrade || null,
          nova_group: productInfo?.novaGroup || null,
          allergens: productInfo?.allergens || null,
          nutritional_values: productInfo?.nutriments || null,
          packaging: productInfo?.packaging || null,
          labels: productInfo?.labels || null,
          origin: productInfo?.origin || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Inserisci categorie
      const categoriesToInsert: string[] = [];
      if (productInfo?.categories) categoriesToInsert.push(...productInfo.categories);
      if (newProduct.category.trim() && !categoriesToInsert.includes(newProduct.category.trim())) {
        categoriesToInsert.push(newProduct.category.trim());
      }
      if (categoriesToInsert.length > 0) {
        await supabase.from("product_categories").insert(
          categoriesToInsert.map((cat) => ({ product_id: insertedProduct.id, category_name: cat }))
        );
      }

      // Aggiungi a dispensa se specificata
      const hasValidDispensa = newProduct.dispensa_id && newProduct.dispensa_id !== "none" && newProduct.dispensa_id.length > 10;
      if (hasValidDispensa) {
        await supabase.from("dispense_products").insert({
          dispensa_id: newProduct.dispensa_id,
          product_id: insertedProduct.id,
          quantity: newProduct.quantity,
          expiry_date: expiryDate ? format(expiryDate, "yyyy-MM-dd") : null,
        });
      }

      toast.success("Prodotto aggiunto con successo");
      addLocalNotification("Prodotto aggiunto", `${productName || "Prodotto"} aggiunto all'inventario`, "success");
      refetch();
      return true;
    } catch (error) {
      console.error("Error adding product:", error);
      toast.error("Errore nell'aggiunta del prodotto");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Elimina un singolo prodotto
   * - Rimuove dalle dispense
   * - Rimuove le categorie associate
   * - Elimina il prodotto
   */
  const deleteProduct = async (productId: string) => {
    try {
      await supabase.from("dispense_products").delete().eq("product_id", productId);
      await supabase.from("product_categories").delete().eq("product_id", productId);
      const { error } = await supabase.from("products").delete().eq("id", productId);
      if (error) throw error;
      
      toast.success("Prodotto eliminato");
      addLocalNotification("Prodotto eliminato", "Prodotto rimosso dall'inventario", "info");
      refetch();
      return true;
    } catch (error) {
      console.error("Error deleting product:", error);
      toast.error("Errore nell'eliminazione");
      return false;
    }
  };

  /**
   * Elimina più prodotti contemporaneamente
   * - Itera su tutti gli ID selezionati
   * - Per ciascuno rimuove da dispense, categorie e products
   */
  const deleteProducts = async (productIds: Set<string>) => {
    if (productIds.size === 0) return false;
    
    try {
      for (const productId of productIds) {
        await supabase.from("dispense_products").delete().eq("product_id", productId);
        await supabase.from("product_categories").delete().eq("product_id", productId);
        await supabase.from("products").delete().eq("id", productId);
      }
      
      toast.success(`${productIds.size} prodotti eliminati`);
      refetch();
      return true;
    } catch (error) {
      console.error("Error bulk deleting:", error);
      toast.error("Errore nell'eliminazione");
      return false;
    }
  };

  /**
   * Modifica rapidamente la quantità di un prodotto
   * - Prende il primo dispensa_product associato
   * - Aggiorna la quantità (minimo 0)
   * - Aggiorna lo stato locale per feedback immediato
   */
  const updateQuantity = async (
    product: ProductWithDetails, 
    delta: number, 
    setProducts: (fn: (prev: ProductWithDetails[]) => ProductWithDetails[]) => void
  ) => {
    if (product.dispensaProducts.length === 0) {
      toast.error("Prodotto non assegnato a nessuna dispensa");
      return;
    }
    
    // Usa il primo dispensa_product
    const dp = product.dispensaProducts[0];
    const newQty = Math.max(0, dp.quantity + delta);
    
    try {
      await supabase
        .from("dispense_products")
        .update({ quantity: newQty })
        .eq("id", dp.id);
      
      // Aggiorna stato locale per feedback immediato
      setProducts(prev => prev.map(p => {
        if (p.id === product.id) {
          const updatedDp = p.dispensaProducts.map(d => 
            d.id === dp.id ? { ...d, quantity: newQty } : d
          );
          return {
            ...p,
            totalQuantity: updatedDp.reduce((sum, d) => sum + d.quantity, 0),
            dispensaProducts: updatedDp,
          };
        }
        return p;
      }));
    } catch (error) {
      console.error("Error updating quantity:", error);
      toast.error("Errore nell'aggiornamento");
    }
  };

  return {
    addProduct,
    deleteProduct,
    deleteProducts,
    updateQuantity,
    isSubmitting,
  };
}