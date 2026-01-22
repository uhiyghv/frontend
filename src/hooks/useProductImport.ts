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

  const importProducts = async (file: File): Promise<boolean> => {
    if (!userId || !groupId) return false;
    setIsImporting(true);

    return new Promise<boolean>((resolve) => {
      try {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
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
              setIsImporting(false);
              resolve(false);
              return;
            }

            // Mapping, Validation e Inserimento
            const productsToInsert = jsonData.map(item => {
              const barcode = String(item.barcode || item.codice_a_barre || "").replace(/\D/g, '').slice(0, 13);
              const name = String(item.name || item.nome || "").slice(0, 200);
              const brand = String(item.brand || item.marca || "").slice(0, 100);
              const category = String(item.category || item.categoria || "").slice(0, 100);
              const nutriscore = String(item.nutriscore || "").slice(0, 1).toLowerCase();
              const origin = String(item.origin || item.origine || "").slice(0, 200);
              
              return {
                user_id: userId,
                group_id: groupId,
                name: name || null,
                barcode: barcode || null,
                brand: brand || null,
                category: category || null,
                nutriscore: ['a', 'b', 'c', 'd', 'e'].includes(nutriscore) ? nutriscore : null,
                origin: origin || null,
              };
            }).filter(p => p.barcode && p.barcode.length >= 8 && p.barcode.length <= 13);

            if (productsToInsert.length === 0) {
              toast.error("Nessun prodotto valido trovato nel file");
              setIsImporting(false);
              resolve(false);
              return;
            }

            const { error } = await supabase.from("products").insert(productsToInsert);

            if (error) throw error;

            toast.success(`${productsToInsert.length} prodotti importati con successo`);
            refetch();
            setIsImporting(false);
            resolve(true);
          } catch (innerError) {
            console.error("Errore elaborazione file:", innerError);
            toast.error("Errore durante l'elaborazione del file");
            setIsImporting(false);
            resolve(false);
          }
        };

        reader.onerror = () => {
          toast.error("Errore nella lettura del file");
          setIsImporting(false);
          resolve(false);
        };

        if (file.name.endsWith(".json")) {
          reader.readAsText(file);
        } else {
          reader.readAsArrayBuffer(file);
        }
      } catch (error) {
        console.error("Errore importazione:", error);
        toast.error("Errore durante l'importazione del file");
        setIsImporting(false);
        resolve(false);
      }
    });
  };

  return { importProducts, isImporting };
}