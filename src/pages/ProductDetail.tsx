import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ArrowLeft,
  Package,
  Barcode,
  Tag,
  Edit,
  Save,
  X,
  Loader2,
  Warehouse,
  TrendingUp,
  TrendingDown,
  Clock,
  Trash2,
  Leaf,
  Apple,
  AlertTriangle,
  Globe,
  Building,
  Plus,
  Minus,
  Box,
  Award,
  MapPin,
  Flame,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/backend/client";
import { toast } from "sonner";
import { useNotificationContext } from "@/contexts/NotificationContext";
import { getCachedLogo, setCachedLogo, urlToBase64 } from "@/utils/logoCache";

import countries from "i18n-iso-countries";
import itLocale from "i18n-iso-countries/langs/it.json";
import enLocale from "i18n-iso-countries/langs/en.json";
import Fuse from "fuse.js";

// Registrazione lingue
countries.registerLocale(itLocale);
countries.registerLocale(enLocale);

// 1. Setup dei dati per la ricerca fuzzy
const itNames = countries.getNames("it", { select: "official" });
const enNames = countries.getNames("en", { select: "official" });

const searchData = Object.entries(itNames).map(([code, name]) => ({
  code,
  nameIt: name.toLowerCase(),
  nameEn: (enNames[code] || "").toLowerCase()
}));

// 2. Configurazione Fuse.js
const fuse = new Fuse(searchData, {
  keys: ["nameIt", "nameEn"],
  threshold: 0.4, // Permette una buona tolleranza per nomi incompleti
  distance: 100
});

const parseOriginCountries = (origin: string): { code: string; name: string }[] => {
  if (!origin) return [];

  const foundCountries: { code: string; name: string }[] = [];
  
  // Pulizia della stringa: rimuoviamo prefissi comuni
  const cleanOrigin = origin
    .replace(/(made in|prodotto in|origin:|from|origine:)/gi, "")
    .trim();
  
  // Dividiamo per i separatori comuni
  const parts = cleanOrigin.split(/[,;\/\-]/).map(p => p.trim()).filter(Boolean);
  
  for (const part of parts) {
    // Cerchiamo il paese usando la ricerca fuzzy
    const results = fuse.search(part);
    
    if (results.length > 0) {
      const bestMatch = results[0].item;
      
      // Evitiamo duplicati
      if (!foundCountries.some(c => c.code === bestMatch.code)) {
        foundCountries.push({
          code: bestMatch.code,
          // Restituiamo il nome ufficiale in italiano
          name: countries.getName(bestMatch.code, "it") || part 
        });
      }
    }
  }
  
  return foundCountries;
};


// Origin Flags Component with Tooltips
const OriginFlags = ({ origin }: { origin: string }) => {
  const countries = parseOriginCountries(origin);
  
  if (countries.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <Globe className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-xs text-muted-foreground">Origine</p>
          <p className="font-medium text-sm">{origin}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-2">
      <MapPin className="h-4 w-4 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">Origine</p>
        <div className="flex items-center gap-2 mt-1">
          {countries.map((country) => (
            <Tooltip key={country.code}>
              <TooltipTrigger asChild>
                <img
                  src={`https://flagcdn.com/w40/${country.code.toLowerCase()}.png`}
                  alt={country.name}
                  className="h-5 w-auto rounded-[5px] shadow-sm cursor-pointer hover:scale-110 transition-transform border aspect-[3/2]"
                />
              </TooltipTrigger>
              <TooltipContent>
                <p>{country.name}</p>
              </TooltipContent>
            </Tooltip>
          ))}
          {countries.length === 0 && (
            <span className="font-medium text-sm">{origin}</span>
          )}
        </div>
      </div>
    </div>
  );
};

// --- TYPES ---
interface Product {
  id: string;
  name: string | null;
  barcode: string | null;
  category: string | null;
  image_url: string | null;
  brand: string | null;
  ingredients: string | null;
  nutriscore: string | null;
  ecoscore: string | null;
  nova_group: number | null;
  allergens: string | null;
  nutritional_values: any;
  packaging: string | null;
  labels: string | null;
  origin: string | null;
  carbon_footprint: any;
  created_at: string;
  updated_at: string;
}

interface ProductLocation {
  id: string;
  dispensa_id: string;
  dispensa_name: string;
  quantity: number;
  threshold: number;
  last_scanned_at: string | null;
}

interface ScanLog {
  id: string;
  action: string;
  quantity: number;
  created_at: string;
  dispensa_name: string;
}

interface Dispensa {
  id: string;
  name: string;
}

// --- UTILITIES ---

// Funzione per calcolare il colore dei nutrienti (Semaforo Alimentare semplificato)
const getNutrientStyle = (key: string, val: number) => {
  if (val === null || val === undefined) return "bg-muted text-foreground";

  // Classi base per i colori
  const green =
    "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800";
  const yellow =
    "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800";
  const orange =
    "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800";
  const red =
    "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800";

  // Logica "Less is Better" (Grassi, Zuccheri, Sale)
  if (["fat", "saturatedFat", "sugars", "salt", "sodium"].includes(key)) {
    // Soglie approssimative per 100g
    if (key === "saturatedFat") {
      if (val <= 1.5) return green;
      if (val <= 5) return yellow;
      return red;
    }
    if (key === "sugars") {
      if (val <= 5) return green;
      if (val <= 22.5) return yellow;
      return red;
    }
    if (key === "salt" || key === "sodium") {
      // Sodium conversion approx check
      const checkVal = key === "sodium" ? val / 1000 : val;
      if (checkVal <= 0.3) return green;
      if (checkVal <= 1.5) return yellow;
      return red;
    }
    if (key === "fat") {
      if (val <= 3) return green;
      if (val <= 17.5) return yellow;
      return red;
    }
  }

  // Logica "More is Better" (Proteine, Fibre)
  if (["proteins", "fiber"].includes(key)) {
    if (val >= 8) return green;
    if (val >= 4) return yellow;
    return orange; // Low protein isn't necessarily "red/bad", just low
  }

  // Energy is neutral contextually, stick to muted or simple distinctive color
  if (key === "energyKcal") {
    return "bg-blue-50 text-blue-800 border-blue-100 dark:bg-blue-900/20 dark:text-blue-300";
  }

  return "bg-muted text-foreground";
};

// --- COMPONENT ---

const ProductDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addLocalNotification } = useNotificationContext();

  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [locations, setLocations] = useState<ProductLocation[]>([]);
  const [scanLogs, setScanLogs] = useState<ScanLog[]>([]);
  const [dispense, setDispense] = useState<Dispensa[]>([]);
  const [flagUrl, setFlagUrl] = useState<string | null>(null);
  const [brandLogoUrl, setBrandLogoUrl] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedProduct, setEditedProduct] = useState<Partial<Product>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Dialog states
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedDispensaId, setSelectedDispensaId] = useState<string>("");
  const [assignQuantity, setAssignQuantity] = useState(1);

  const BRAND_FETCH_API_KEY = import.meta.env.VITE_BRANDFETCH_API_KEY;

  useEffect(() => {
    fetchProductData();
  }, [id]);

  // Fetch Flag Effect
  useEffect(() => {
    if (!product?.origin) {
      setFlagUrl(null);
      return;
    }

    const fetchFlag = async () => {
      // Pulisce la stringa (es. "Made in Italy" -> "Italy", "P.R.C." -> "China")
      let cleanCountry = product
        .origin!.toLowerCase()
        .replace("made in", "")
        .replace("prodotto in", "")
        .replace("origin:", "")
        .trim();

      // Fix comuni per API restcountries
      if (cleanCountry === "uk" || cleanCountry === "united kingdom")
        cleanCountry = "Great Britain";
      if (cleanCountry === "usa" || cleanCountry === "us")
        cleanCountry = "United States";
      if (cleanCountry.includes("eu") || cleanCountry.includes("european"))
        return; // L'API non ha bandiera EU

      try {
        // Prende solo il primo risultato e solo il campo flags per risparmiare banda
        const res = await fetch(
          `https://restcountries.com/v3.1/name/${cleanCountry}?fields=flags`
        );
        if (!res.ok) throw new Error("Flag not found");
        const data = await res.json();
        if (data && data.length > 0 && data[0].flags) {
          setFlagUrl(data[0].flags.svg);
        }
      } catch (error) {
        console.log("Could not fetch flag for:", cleanCountry);
        setFlagUrl(null);
      }
    };

    fetchFlag();
  }, [product?.origin]);

  const fetchProductData = async () => {
    if (!id) return;
    try {
      const [productRes, dispenseRes] = await Promise.all([
        supabase.from("products").select("*").eq("id", id).maybeSingle(),
        supabase.from("dispense").select("id, name"),
      ]);

      if (productRes.error) throw productRes.error;
      if (!productRes.data) {
        toast.error("Prodotto non trovato");
        navigate("/inventario");
        return;
      }

      setProduct(productRes.data);
      setEditedProduct(productRes.data);
      setDispense(dispenseRes.data || []);

      const { data: catData } = await supabase
        .from("product_categories")
        .select("category_name")
        .eq("product_id", id);
      setCategories(catData?.map((c) => c.category_name) || []);

      const { data: locData } = await supabase
        .from("dispense_products")
        .select(
          "id, dispensa_id, quantity, threshold, last_scanned_at, dispense:dispensa_id(name)"
        )
        .eq("product_id", id);

      setLocations(
        (locData || []).map((loc: any) => ({
          id: loc.id,
          dispensa_id: loc.dispensa_id,
          dispensa_name: loc.dispense?.name || "Sconosciuta",
          quantity: loc.quantity,
          threshold: loc.threshold,
          last_scanned_at: loc.last_scanned_at,
        }))
      );

      const { data: logsData } = await supabase
        .from("scan_logs")
        .select("id, action, quantity, created_at, dispense:dispensa_id(name)")
        .eq("product_id", id)
        .order("created_at", { ascending: false })
        .limit(10);

      setScanLogs(
        (logsData || []).map((log: any) => ({
          id: log.id,
          action: log.action,
          quantity: log.quantity,
          created_at: log.created_at,
          dispensa_name: log.dispense?.name || "Sconosciuta",
        }))
      );
    } catch (error) {
      console.error("Error fetching product:", error);
      toast.error("Errore nel caricamento del prodotto");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!product) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("products")
        .update({
          name: editedProduct.name || null,
          category: editedProduct.category,
          barcode: editedProduct.barcode,
        })
        .eq("id", product.id);

      if (error) throw error;
      setProduct({ ...product, ...editedProduct } as Product);
      setIsEditing(false);
      toast.success("Prodotto aggiornato");
    } catch (error) {
      console.error("Error updating product:", error);
      toast.error("Errore nell'aggiornamento");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!product) return;
    try {
      await supabase
        .from("dispense_products")
        .delete()
        .eq("product_id", product.id);
      await supabase
        .from("product_categories")
        .delete()
        .eq("product_id", product.id);
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", product.id);

      if (error) throw error;
      toast.success("Prodotto eliminato");
      addLocalNotification(
        "Prodotto eliminato",
        `${product.name || "Prodotto"} rimosso`,
        "info"
      );
      navigate("/inventario");
    } catch (error) {
      console.error("Error deleting product:", error);
      toast.error("Errore nell'eliminazione");
    }
  };

  const handleAssignToDispensa = async () => {
    if (!product || !selectedDispensaId) {
      toast.error("Seleziona una dispensa");
      return;
    }
    const existing = locations.find(
      (l) => l.dispensa_id === selectedDispensaId
    );
    if (existing) {
      toast.error("Prodotto già assegnato a questa dispensa");
      return;
    }

    try {
      const { error } = await supabase.from("dispense_products").insert({
        dispensa_id: selectedDispensaId,
        product_id: product.id,
        quantity: assignQuantity,
      });
      if (error) throw error;
      toast.success("Assegnato con successo");
      setShowAssignDialog(false);
      setSelectedDispensaId("");
      setAssignQuantity(1);
      fetchProductData();
    } catch (error) {
      console.error("Error assigning:", error);
      toast.error("Errore nell'assegnazione");
    }
  };

  const handleUpdateQuantity = async (
    locationId: string,
    newQuantity: number
  ) => {
    if (newQuantity < 0) return;
    try {
      const { error } = await supabase
        .from("dispense_products")
        .update({ quantity: newQuantity })
        .eq("id", locationId);
      if (error) throw error;
      setLocations(
        locations.map((l) =>
          l.id === locationId ? { ...l, quantity: newQuantity } : l
        )
      );
    } catch (error) {
      toast.error("Errore aggiornamento quantità");
    }
  };

  const handleRemoveFromDispensa = async (locationId: string) => {
    try {
      const { error } = await supabase
        .from("dispense_products")
        .delete()
        .eq("id", locationId);
      if (error) throw error;
      toast.success("Rimosso dalla dispensa");
      fetchProductData();
    } catch (error) {
      toast.error("Errore nella rimozione");
    }
  };

  // --- DERIVED UI DATA ---
  const totalQuantity = useMemo(
    () => locations.reduce((sum, loc) => sum + loc.quantity, 0),
    [locations]
  );
  const availableDispense = useMemo(
    () =>
      dispense.filter((d) => !locations.some((l) => l.dispensa_id === d.id)),
    [dispense, locations]
  );

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString("it-IT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  const formatAllergens = (allergens: string) =>
    allergens.replace(/en:/g, "").replace(/,/g, ", ").trim();

  // Helper for Colors (Scores)
  const getScoreColor = (
    score: string | number | null,
    type: "nutri" | "eco" | "nova"
  ) => {
    if (!score) return "bg-gray-200";
    const s = String(score).toLowerCase();

    if (type === "nova") {
      const map: Record<string, string> = {
        "1": "bg-green-500",
        "2": "bg-lime-500",
        "3": "bg-orange-400",
        "4": "bg-red-500",
      };
      return map[s] || "bg-gray-200";
    }

    const map: Record<string, string> = {
      a: "bg-green-600",
      b: "bg-lime-500",
      c: "bg-yellow-400",
      d: "bg-orange-500",
      e: "bg-red-600",
    };
    return map[s] || "bg-gray-200";
  };

  const normalizeBrandToDomain = (brand: string) =>
    brand
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, "")
      .concat(".com");

  useEffect(() => {
    if (!product?.brand) {
      setBrandLogoUrl(null);
      return;
    }

    const loadLogo = async () => {
      const brandName = product.brand!.trim();

      // 1. Controlla la cache
      const cached = getCachedLogo(brandName);
      if (cached) {
        console.log("Logo caricato da cache per:", brandName);
        setBrandLogoUrl(cached);
        return;
      }

      try {
        const domain = normalizeBrandToDomain(brandName);

        // Se non abbiamo l'API KEY, usiamo un fallback o un URL diretto se possibile
        if (!BRAND_FETCH_API_KEY) return;

        const res = await fetch(
          `https://cdn.brandfetch.io/${domain}?c=${BRAND_FETCH_API_KEY}`
        );
        console.log("Fetch logo per:", brandName, res);

        if (res.ok) {
          // TRASFORMAZIONE: Invece di salvare res.url, scarichiamo i dati
          const base64Logo = await urlToBase64(res.url);
          
          if (base64Logo) {
            setCachedLogo(brandName, base64Logo);
            setBrandLogoUrl(base64Logo);
          }
        } else {
          setBrandLogoUrl(null);
        }
      } catch (error) {
        console.error("Errore fetch logo:", error);
        setBrandLogoUrl(null);
      }
    };

    loadLogo();
  }, [product?.brand]);

  console.log("Brand Logo URL:", brandLogoUrl);

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  if (!product) return null;

  const brandInitials = product.brand
    ? product.brand.substring(0, 2).toUpperCase()
    : "??";

  return (
    <div className="space-y-6 container mx-auto pb-10">
      {/* --- DIALOGS --- */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questo prodotto?</AlertDialogTitle>
            <AlertDialogDescription>
              L'operazione rimuoverà il prodotto da tutte le dispense. Non è
              reversibile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Assegna a Dispensa</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Seleziona Dispensa</Label>
              <Select
                value={selectedDispensaId}
                onValueChange={setSelectedDispensaId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Scegli..." />
                </SelectTrigger>
                <SelectContent>
                  {availableDispense.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantità Iniziale</Label>
              <Input
                type="number"
                min="1"
                value={assignQuantity}
                onChange={(e) =>
                  setAssignQuantity(parseInt(e.target.value) || 1)
                }
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAssignToDispensa}
              disabled={!selectedDispensaId}
            >
              Conferma
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* --- HEADER --- */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4 border-b pb-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">
              {product.name || "Prodotto Senza Nome"}
            </h1>
            {/* Bandiera reale o fallback */}
            {flagUrl ? (
              <img
                src={flagUrl}
                alt={product.origin || "Origin flag"}
                className="h-6 w-auto shadow-sm rounded-sm object-cover aspect-[3/2]"
                title={product.origin || ""}
              />
            ) : product.origin ? (
              <Globe
                className="h-6 w-6 text-muted-foreground"
                xlinkTitle={product.origin || ""}
              />
            ) : null}
          </div>
          <code className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded">
            {product.barcode}
          </code>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          {!isEditing ? (
            <>
              <Button
                variant="outline"
                className="flex-1 md:flex-none"
                onClick={() => setIsEditing(true)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Modifica
              </Button>
              <Button
                variant="destructive"
                className="flex-1 md:flex-none"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Elimina
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setIsEditing(false)}>
                <X className="h-4 w-4 mr-2" />
                Annulla
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Salva
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* --- MAIN DETAILS --- */}
        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader className="bg-muted/30">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Scheda Prodotto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {/* Image & Brand Section */}
            <div className="flex flex-col sm:flex-row gap-6">
              {product.image_url && (
                <div className="shrink-0">
                  <img
                    src={product.image_url}
                    alt={product.name || "Prodotto"}
                    className="h-48 w-full sm:w-48 rounded-lg object-contain bg-white border p-2 shadow-sm"
                  />
                </div>
              )}

              <div className="flex-1 space-y-4">
                {isEditing ? (
                  <div className="grid gap-3">
                    <div className="space-y-1">
                      <Label>Nome</Label>
                      <Input
                        value={editedProduct.name || ""}
                        onChange={(e) =>
                          setEditedProduct({
                            ...editedProduct,
                            name: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Brand</Label>
                      <Input
                        value={editedProduct.brand || ""}
                        onChange={(e) =>
                          setEditedProduct({
                            ...editedProduct,
                            brand: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Categoria</Label>
                      <Input
                        value={editedProduct.category || ""}
                        onChange={(e) =>
                          setEditedProduct({
                            ...editedProduct,
                            category: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Brand Smart Display */}
                    {product.brand && (
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-dashed">
                        <Avatar className="h-10 w-10 border bg-white">
                          {brandLogoUrl == null || brandLogoUrl == "" || brandLogoUrl == undefined ? (
                            <AvatarFallback className="bg-primary/10 text-primary font-bold">
                              {brandInitials}
                            </AvatarFallback>
                          ) : (
                            <AvatarImage
                              src={brandLogoUrl}
                              alt={product.brand || "Brand logo"}
                              className="object-contain p-1"
                            />
                          )}
                        </Avatar>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                            Marca
                          </p>
                          <p className="font-medium">{product.brand}</p>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Categoria
                          </p>
                          <p className="font-medium">
                            {product.category || "—"}
                          </p>
                        </div>
                      </div>
                      {product.origin && (
                        <OriginFlags origin={product.origin} />
                      )}
                      {!product.origin && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">Origine</p>
                            <p className="font-medium">—</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Categories Tags */}
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <Badge key={cat} variant="secondary" className="px-3 py-1">
                    {cat}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* --- STATS & SCORES --- */}
        <div className="space-y-6">
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Disponibilità
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-extrabold text-primary">
                {totalQuantity}
                <span className="text-lg font-normal text-muted-foreground ml-2">
                  pz
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                In {locations.length} dispens
                {locations.length === 1 ? "a" : "e"}
              </p>
            </CardContent>
          </Card>

          {(product.nutriscore || product.ecoscore || product.nova_group) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Award className="h-5 w-5 text-orange-500" />
                  Valutazioni
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {product.nutriscore && (
                  <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                    <span className="text-sm font-medium">Nutri-Score</span>
                    <Badge
                      className={`${getScoreColor(
                        product.nutriscore,
                        "nutri"
                      )} text-white border-0 px-3 py-1 pointer-events-none`}
                    >
                      {product.nutriscore.toUpperCase()}
                    </Badge>
                  </div>
                )}
                {product.ecoscore && (
                  <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                    <span className="text-sm font-medium">Eco-Score</span>
                    <Badge
                      className={`${getScoreColor(
                        product.ecoscore,
                        "eco"
                      )} text-white border-0 px-3 py-1 pointer-events-none`}
                    >
                      {product.ecoscore.toUpperCase()}
                    </Badge>
                  </div>
                )}
                {product.nova_group && (
                  <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                    <span className="text-sm font-medium">NOVA</span>
                    <Badge
                      className={`${getScoreColor(
                        product.nova_group,
                        "nova"
                      )} text-white border-0 px-3 py-1 pointer-events-none`}
                    >
                      {product.nova_group}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* --- INGREDIENTS & NUTRITION --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {product.ingredients && (
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Apple className="h-5 w-5 text-green-600" />
                Ingredienti
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {product.ingredients}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Allergen Card: Always Rendered to fill layout hole */}
        <Card
          className={`h-full ${
            product.allergens
              ? "border-orange-200 bg-orange-50/50 dark:bg-orange-950/10"
              : "border-green-200 bg-green-50/50 dark:bg-green-950/10"
          }`}
        >
          <CardHeader>
            <CardTitle
              className={`flex items-center gap-2 ${
                product.allergens
                  ? "text-orange-600 dark:text-orange-400"
                  : "text-green-600 dark:text-green-400"
              }`}
            >
              {product.allergens ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <ShieldCheck className="h-5 w-5" />
              )}
              Allergeni
            </CardTitle>
          </CardHeader>
          <CardContent>
            {product.allergens ? (
              <p className="text-sm font-medium">
                {formatAllergens(product.allergens)}
              </p>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <p className="text-sm font-medium text-green-700 dark:text-green-300">
                  Nessun allergene segnalato
                </p>
                <p className="text-xs text-green-600/80 mt-1">
                  Il produttore non ha indicato allergeni per questo prodotto.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* --- VALUES --- */}
      {product.nutritional_values && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-red-500" />
              Valori Nutrizionali{" "}
              <span className="text-sm font-normal text-muted-foreground ml-2">
                (per 100g)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
              {[
                {
                  key: "energyKcal",
                  label: "Energia",
                  val: product.nutritional_values.energyKcal,
                  unit: "kcal",
                },
                {
                  key: "fat",
                  label: "Grassi",
                  val: product.nutritional_values.fat,
                  unit: "g",
                },
                {
                  key: "saturatedFat",
                  label: "G. Saturi",
                  val: product.nutritional_values.saturatedFat,
                  unit: "g",
                },
                {
                  key: "carbohydrates",
                  label: "Carboidrati",
                  val: product.nutritional_values.carbohydrates,
                  unit: "g",
                },
                {
                  key: "sugars",
                  label: "Zuccheri",
                  val: product.nutritional_values.sugars,
                  unit: "g",
                },
                {
                  key: "fiber",
                  label: "Fibre",
                  val: product.nutritional_values.fiber,
                  unit: "g",
                },
                {
                  key: "proteins",
                  label: "Proteine",
                  val: product.nutritional_values.proteins,
                  unit: "g",
                },
                {
                  key: "salt",
                  label: "Sale",
                  val: product.nutritional_values.salt,
                  unit: "g",
                },
              ].map(
                (item, i) =>
                  item.val !== undefined &&
                  item.val !== null && (
                    <div
                      key={i}
                      className={`flex flex-col items-center justify-center p-3 rounded-lg text-center border shadow-sm transition-colors ${getNutrientStyle(
                        item.key,
                        item.val
                      )}`}
                    >
                      <span className="text-xs opacity-80 mb-1 font-medium uppercase tracking-wide">
                        {item.label}
                      </span>
                      <span className="font-bold text-lg">
                        {item.val}
                        <span className="text-sm font-normal ml-0.5">
                          {item.unit}
                        </span>
                      </span>
                    </div>
                  )
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* --- INVENTORY LOCATIONS --- */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/10">
          <CardTitle className="flex items-center gap-2">
            <Warehouse className="h-5 w-5 text-primary" />
            Gestione Dispensa
          </CardTitle>
          {availableDispense.length > 0 && (
            <Button size="sm" onClick={() => setShowAssignDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Nuova Assegnazione
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-6">
          {locations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground flex flex-col items-center">
              <div className="bg-muted p-4 rounded-full mb-4">
                <Warehouse className="h-8 w-8 opacity-50" />
              </div>
              <p className="font-medium">Nessuna dispensa assegnata</p>
              <p className="text-sm mb-4">
                Questo prodotto non è presente fisicamente in nessuna dispensa.
              </p>
              {availableDispense.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => setShowAssignDialog(true)}
                >
                  Assegna Ora
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {locations.map((loc) => (
                <div
                  key={loc.id}
                  className="relative p-5 rounded-xl border bg-card hover:shadow-md transition-all duration-200 group"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-semibold text-lg">
                        {loc.dispensa_name}
                      </h4>
                      {loc.last_scanned_at && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3" />{" "}
                          {formatDate(loc.last_scanned_at)}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleRemoveFromDispensa(loc.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex items-center justify-between bg-muted/50 p-2 rounded-lg">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 bg-background shadow-sm"
                      onClick={() =>
                        handleUpdateQuantity(loc.id, loc.quantity - 1)
                      }
                      disabled={loc.quantity === 0}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <div className="text-center min-w-[3rem]">
                      <span
                        className={`text-xl font-bold ${
                          loc.quantity <= loc.threshold ? "text-orange-500" : ""
                        }`}
                      >
                        {loc.quantity}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 bg-background shadow-sm"
                      onClick={() =>
                        handleUpdateQuantity(loc.id, loc.quantity + 1)
                      }
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>

                  {loc.quantity <= loc.threshold && loc.quantity > 0 && (
                    <div className="absolute top-0 right-0 -mt-2 -mr-2">
                      <span className="flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scan Logs kept similar but styled... */}
      {scanLogs.length > 0 && (
        <div className="pt-4 border-t">
          <h3 className="text-sm font-semibold text-muted-foreground mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4" /> Ultimi Movimenti
          </h3>
          <div className="space-y-2">
            {scanLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between text-sm py-2 px-3 rounded-md hover:bg-muted/50 transition-colors border-b last:border-0 border-dashed"
              >
                <div className="flex items-center gap-3">
                  {log.action === "add" ? (
                    <div className="p-1 bg-green-100 text-green-700 rounded">
                      <TrendingUp className="h-3 w-3" />
                    </div>
                  ) : (
                    <div className="p-1 bg-red-100 text-red-700 rounded">
                      <TrendingDown className="h-3 w-3" />
                    </div>
                  )}
                  <span className="font-medium text-foreground/80">
                    {log.action === "add" ? "+" : "-"}
                    {log.quantity}
                  </span>
                  <span className="text-muted-foreground">
                    in {log.dispensa_name}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground font-mono">
                  {formatDate(log.created_at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductDetail;