// hooks/useProductImport.ts
import { useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/backend/client";
import { toast } from "sonner";

export function useProductImport(
  userId: string | undefined,
  groupId: string | undefined,
  refetch: () => void
) {
  const [isImporting, setIsImporting] = useState(false);

  const importProducts = async (file: File) => {
    if (!userId || !groupId) return;
    setIsImporting(true);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = e.target?.result;
        let jsonData: any[] = [];

        if (file.name.endsWith(".json")) {
          jsonData = JSON.parse(data as string);
        } else {
          // Gestione CSV ed Excel
          const workbook = XLSX.read(data, { type: "binary" });
          const sheetName = workbook.SheetNames[0];
          jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        }

        if (jsonData.length === 0) {
          toast.error("Il file sembra vuoto");
          return;
        }

        // Mapping e Inserimento
        const productsToInsert = jsonData.map(item => ({
          user_id: userId,
          group_id: groupId,
          name: item.name || item.nome,
          barcode: String(item.barcode || item.codice_a_barre || ""),
          brand: item.brand || item.marca,
          category: item.category || item.categoria,
          nutriscore: item.nutriscore,
          origin: item.origin || item.origine,
        })).filter(p => p.barcode !== "");

        const { error } = await supabase.from("products").insert(productsToInsert);

        if (error) throw error;

        toast.success(`${productsToInsert.length} prodotti importati con successo`);
        refetch();
      };

      if (file.name.endsWith(".json")) {
        reader.readAsText(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    } catch (error) {
      console.error("Errore importazione:", error);
      toast.error("Errore durante l'importazione del file");
    } finally {
      setIsImporting(false);
    }
  };

  return { importProducts, isImporting };
}