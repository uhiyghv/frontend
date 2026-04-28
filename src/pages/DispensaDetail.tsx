import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Warehouse,
  Cpu,
  Package,
  Loader2,
  Search,
  Wifi,
  WifiOff,
  Edit,
  Trash2,
  QrCode,
  Save,
  X,
  LayoutGrid,
  List,
  MapPin,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/backend/client";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { useNotificationContext } from "@/contexts/NotificationContext";
import { useActiveGroup } from "@/contexts/ActiveGroupContext";
import { ScannerFab } from "@/components/ScannerFab";

interface Dispensa {
  id: string;
  name: string;
  location: string | null;
  color: string | null;
  products_count: number | null;
  created_at: string;
  group_id: string | null;
}

interface Scanner {
  id: string;
  name: string;
  serial_number: string;
  last_seen_at: string | null;
}

interface ProductInDispensa {
  id: string;
  product_id: string;
  product_name: string | null;
  product_image: string | null;
  product_brand: string | null;
  product_origin: string | null;
  quantity: number;
  threshold: number;
  last_scanned_at: string | null;
}

// Helper to check if scanner is online (last seen < 5 minutes ago)
const isScannerOnline = (lastSeenAt: string | null): boolean => {
  if (!lastSeenAt) return false;
  const lastSeen = new Date(lastSeenAt);
  const now = new Date();
  const diffMs = now.getTime() - lastSeen.getTime();
  const diffMins = diffMs / 60000;
  return diffMins < 5;
};

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#d946ef", "#ec4899", "#f43f5e",
  "#f97316", "#eab308", "#84cc16", "#22c55e", "#14b8a6",
  "#06b6d4", "#0ea5e9", "#3b82f6",
];

const DispensaDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addLocalNotification } = useNotificationContext();
  const { activeGroup } = useActiveGroup();
  const [dispensa, setDispensa] = useState<Dispensa | null>(null);
  const [scanners, setScanners] = useState<Scanner[]>([]);
  const [products, setProducts] = useState<ProductInDispensa[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedScanner, setSelectedScanner] = useState<Scanner | null>(null);
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);
  const [productsView, setProductsView] = useState<"cards" | "table">("cards");
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editColor, setEditColor] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchDispensaData();
  }, [id]);

  const fetchDispensaData = async () => {
    if (!id) return;

    try {
      const { data: dispensaData, error: dispensaError } = await supabase
        .from("dispense")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (dispensaError) throw dispensaError;
      if (!dispensaData) {
        toast.error("Dispensa non trovata");
        navigate("/dispense");
        return;
      }

      setDispensa(dispensaData);
      setEditName(dispensaData.name);
      setEditLocation(dispensaData.location || "");
      setEditColor(dispensaData.color || "#6366f1");

      const { data: scannersData, error: scannersError } = await supabase
        .from("scanners")
        .select("id, name, serial_number, last_seen_at")
        .eq("dispensa_id", id);

      if (!scannersError) {
        setScanners(scannersData || []);
      }

      const { data: productsData, error: productsError } = await supabase
        .from("dispense_products")
        .select(`
          id,
          product_id,
          quantity,
          threshold,
          last_scanned_at,
          products:product_id (name, image_url, brand, origin)
        `)
        .eq("dispensa_id", id);

      if (!productsError && productsData) {
        setProducts(
          productsData.map((p: any) => ({
            id: p.id,
            product_id: p.product_id,
            product_name: p.products?.name || null,
            product_image: p.products?.image_url || null,
            product_brand: p.products?.brand || null,
            product_origin: p.products?.origin || null,
            quantity: p.quantity,
            threshold: p.threshold,
            last_scanned_at: p.last_scanned_at,
          }))
        );
      }
    } catch (error) {
      console.error("Error fetching dispensa:", error);
      toast.error("Errore nel caricamento");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!dispensa || !editName.trim()) {
      toast.error("Il nome è obbligatorio");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("dispense")
        .update({
          name: editName.trim(),
          location: editLocation.trim() || null,
          color: editColor,
        })
        .eq("id", dispensa.id);

      if (error) throw error;

      setDispensa({
        ...dispensa,
        name: editName.trim(),
        location: editLocation.trim() || null,
        color: editColor,
      });
      setIsEditing(false);
      toast.success("Dispensa aggiornata");
      addLocalNotification("Dispensa aggiornata", `${editName.trim()} modificata con successo`, "success");
    } catch (error) {
      console.error("Error updating dispensa:", error);
      toast.error("Errore nell'aggiornamento");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (dispensa) {
      setEditName(dispensa.name);
      setEditLocation(dispensa.location || "");
      setEditColor(dispensa.color || "#6366f1");
    }
    setIsEditing(false);
  };

  const handleDeleteDispensa = async () => {
    if (!dispensa || !confirm("Sei sicuro di voler eliminare questa dispensa?")) return;

    try {
      const { error } = await supabase.from("dispense").delete().eq("id", dispensa.id);
      if (error) throw error;
      toast.success("Dispensa eliminata");
      addLocalNotification("Dispensa eliminata", `${dispensa.name} rimossa`, "info");
      navigate("/dispense");
    } catch (error) {
      console.error("Error deleting dispensa:", error);
      toast.error("Errore nell'eliminazione");
    }
  };

  const getStatusBadge = (quantity: number, threshold: number) => {
    if (quantity === 0) return <Badge variant="destructive">Esaurito</Badge>;
    if (quantity <= threshold) return <Badge variant="warning">Sotto soglia</Badge>;
    return <Badge variant="success">Disponibile</Badge>;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString("it-IT", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const filteredProducts = products.filter((p) =>
    (p.product_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!dispensa) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dispense")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          {isEditing ? (
            <div className="space-y-4 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nome *</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Nome dispensa"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-location">Posizione</Label>
                <Input
                  id="edit-location"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  placeholder="es. Cucina, Garage"
                />
              </div>
              <div className="space-y-2">
                <Label>Colore</Label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                        editColor === color ? "border-foreground ring-2 ring-foreground/20" : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setEditColor(color)}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div 
                className="h-12 w-12 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${dispensa.color || '#6366f1'}20` }}
              >
                <Warehouse 
                  className="h-6 w-6" 
                  style={{ color: dispensa.color || '#6366f1' }}
                />
              </div>
              <div>
                <h1 className="text-3xl font-bold">{dispensa.name}</h1>
                <p className="text-muted-foreground">
                  {dispensa.location || "Nessuna posizione"}
                </p>
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={handleCancelEdit} disabled={isSaving}>
                <X className="h-4 w-4 mr-2" />
                Annulla
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Salva
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Modifica
              </Button>
              <Button variant="destructive" onClick={handleDeleteDispensa}>
                <Trash2 className="h-4 w-4 mr-2" />
                Elimina
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div 
                className="h-12 w-12 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${dispensa.color || '#6366f1'}20` }}
              >
                <Package 
                  className="h-6 w-6" 
                  style={{ color: dispensa.color || '#6366f1' }}
                />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Prodotti</p>
                <p className="text-3xl font-bold">{products.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div 
                className="h-12 w-12 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${dispensa.color || '#6366f1'}20` }}
              >
                <Cpu 
                  className="h-6 w-6" 
                  style={{ color: dispensa.color || '#6366f1' }}
                />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Scanner assegnati</p>
                <p className="text-3xl font-bold">{scanners.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-warning/10 flex items-center justify-center">
                <Package className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sotto soglia</p>
                <p className="text-3xl font-bold">
                  {products.filter((p) => p.quantity <= p.threshold && p.quantity > 0).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scanners */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary" />
            Scanner Assegnati
          </CardTitle>
        </CardHeader>
        <CardContent>
          {scanners.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Cpu className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nessuno scanner assegnato a questa dispensa</p>
              <Button
                variant="link"
                className="mt-2"
                onClick={() => navigate("/dispositivi")}
              >
                Vai ai dispositivi
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {scanners.map((scanner) => {
                const isOnline = isScannerOnline(scanner.last_seen_at);
                return (
                  <div
                    key={scanner.id}
                    className="p-4 rounded-lg border bg-card hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Cpu className={`h-5 w-5 ${isOnline ? "text-success" : "text-muted-foreground"}`} />
                        <span className="font-medium">{scanner.name}</span>
                      </div>
                      <Badge variant={isOnline ? "success" : "secondary"}>
                        {isOnline ? (
                          <><Wifi className="h-3 w-3 mr-1" /> Online</>
                        ) : (
                          <><WifiOff className="h-3 w-3 mr-1" /> Offline</>
                        )}
                      </Badge>
                    </div>
                    <code className="text-xs text-muted-foreground block mb-3">
                      {scanner.serial_number}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setSelectedScanner(scanner);
                        setIsQrDialogOpen(true);
                      }}
                    >
                      <QrCode className="h-4 w-4 mr-2" />
                      Mostra QR
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Products */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Prodotti in Dispensa
            </CardTitle>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cerca prodotto..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex rounded-md border shrink-0">
                <Button
                  type="button"
                  variant={productsView === "cards" ? "default" : "ghost"}
                  size="icon"
                  className="rounded-r-none"
                  onClick={() => setProductsView("cards")}
                  title="Vista a schede"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant={productsView === "table" ? "default" : "ghost"}
                  size="icon"
                  className="rounded-l-none"
                  onClick={() => setProductsView("table")}
                  title="Vista a tabella"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nessun prodotto in questa dispensa</p>
              <p className="text-sm">Usa uno scanner per aggiungere prodotti</p>
            </div>
          ) : productsView === "cards" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="relative group overflow-hidden cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5 rounded-lg border bg-card"
                  onClick={() => navigate(`/prodotti/${product.product_id}`)}
                >
                  <Badge
                    variant="secondary"
                    className="absolute top-2 right-2 z-10 font-bold shadow"
                  >
                    x{product.quantity}
                  </Badge>
                  <div className="aspect-square bg-white flex items-center justify-center p-3 border-b">
                    {product.product_image ? (
                      <img
                        src={product.product_image}
                        alt={product.product_name || ""}
                        className="max-h-full max-w-full object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <Package className="h-10 w-10 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="p-2.5 space-y-1">
                    <p className="font-medium text-sm line-clamp-2 leading-tight min-h-[2.5rem]">
                      {product.product_name || <span className="text-muted-foreground italic">Senza nome</span>}
                    </p>
                    <div className="flex items-center justify-between gap-1 text-xs text-muted-foreground">
                      <span className="truncate">{product.product_brand || "—"}</span>
                      {product.product_origin && (
                        <span className="flex items-center gap-0.5 shrink-0">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate max-w-[60px]">{product.product_origin}</span>
                        </span>
                      )}
                    </div>
                    <div className="pt-1">
                      {getStatusBadge(product.quantity, product.threshold)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prodotto</TableHead>
                    <TableHead className="text-center">Quantità</TableHead>
                    <TableHead className="text-center">Soglia</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Ultimo scan</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">
                        {product.product_name || <span className="text-muted-foreground italic">Senza nome</span>}
                      </TableCell>
                      <TableCell className="text-center font-bold">
                        {product.quantity}
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {product.threshold}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(product.quantity, product.threshold)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(product.last_scanned_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/prodotti/${product.product_id}`)}
                        >
                          Dettagli
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* QR Dialog */}
      <Dialog open={isQrDialogOpen} onOpenChange={setIsQrDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              QR Code Dispositivo
            </DialogTitle>
          </DialogHeader>
          {selectedScanner && (
            <div className="flex flex-col items-center space-y-4 py-4">
              <div className="p-4 bg-background rounded-xl border shadow-lg">
                <QRCodeSVG
                  value={selectedScanner.serial_number}
                  size={200}
                  level="H"
                  includeMargin
                  bgColor="transparent"
                  fgColor="hsl(var(--foreground))"
                />
              </div>
              <div className="text-center space-y-1">
                <p className="font-medium">{selectedScanner.name}</p>
                <code className="text-sm font-mono text-muted-foreground">
                  {selectedScanner.serial_number}
                </code>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {id && <ScannerFab defaultDispensaId={id} onScanComplete={fetchDispensaData} />}
    </div>
  );
};

export default DispensaDetail;