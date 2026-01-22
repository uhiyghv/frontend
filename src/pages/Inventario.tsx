import { useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Search, Filter, Plus, Package, Loader2, Eye, Trash2, Columns, 
  Warehouse, CalendarIcon, Minus, Clock, AlertTriangle, FileUp, Download, Info 
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveGroup } from "@/contexts/ActiveGroupContext";
import { useNotificationContext } from "@/contexts/NotificationContext";
import { format, differenceInDays } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useInventoryData } from "@/hooks/useInventoryData";
import { useProductActions } from "@/hooks/useProductActions.ts";
import { useProductImport } from "@/hooks/useProductImport";
import * as XLSX from "xlsx";

type ColumnKey = "select" | "image" | "name" | "brand" | "barcode" | "category" | "dispensa" | "quantity" | "expiry" | "date" | "origin" | "nutriscore" | "ecoscore" | "nova" | "actions";

const ALL_COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "select", label: "Seleziona" },
  { key: "image", label: "Immagine" },
  { key: "name", label: "Prodotto" },
  { key: "brand", label: "Marca" },
  { key: "barcode", label: "Codice a barre" },
  { key: "category", label: "Categoria" },
  { key: "dispensa", label: "Dispensa" },
  { key: "quantity", label: "Quantità" },
  { key: "expiry", label: "Scadenza" },
  { key: "origin", label: "Origine" },
  { key: "nutriscore", label: "Nutri-Score" },
  { key: "ecoscore", label: "Eco-Score" },
  { key: "nova", label: "NOVA" },
  { key: "date", label: "Data creazione" },
  { key: "actions", label: "Azioni" },
];

const Inventario = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeGroup } = useActiveGroup();
  const { addLocalNotification } = useNotificationContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { products, setProducts, dispense, categories, brands, isLoading, refetch } = useInventoryData(user?.id, activeGroup?.id);
  const { addProduct, deleteProduct, deleteProducts, updateQuantity, isSubmitting } = useProductActions(user?.id, activeGroup?.id, refetch, addLocalNotification);
  const { importProducts, isImporting } = useProductImport(user?.id, activeGroup?.id, refetch);

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(["select", "image", "name", "brand", "category", "dispensa", "quantity", "expiry", "actions"]);
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [expiryDate, setExpiryDate] = useState<Date | undefined>();
  const [newProduct, setNewProduct] = useState({
    name: "", barcode: "", category: "", quantity: 1, dispensa_id: "",
  });

  const handleDownloadTemplate = (formatType: 'csv' | 'json' | 'xlsx') => {
    const templateData = [
      { 
        barcode: "8076800195057", 
        name: "Pasta Barilla", 
        brand: "Barilla", 
        category: "Pasta", 
        nutriscore: "A",
        origin: "Italia",
        quantity: 5,
        expiry_date: format(new Date(2025, 11, 31), "yyyy-MM-dd"),
        dispensa_name: dispense[0]?.name
      },
      { 
        barcode: "8002270014901", 
        name: "Passata Mutti", 
        brand: "Mutti", 
        category: "Conserve", 
        nutriscore: "A",
        origin: "Italia",
        quantity: 10,
        expiry_date: "",
        dispensa_name: dispense[0]?.name
      }
    ];

    if (formatType === 'json') {
      const blob = new Blob([JSON.stringify(templateData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'template_inventario.json';
      a.click();
    } else {
      const ws = XLSX.utils.json_to_sheet(templateData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Prodotti");
      XLSX.writeFile(wb, `template_inventario.${formatType === 'xlsx' ? 'xlsx' : 'csv'}`);
    }
  };

  const handleAddProduct = async () => {
    const success = await addProduct(newProduct, expiryDate);
    if (success) {
      setNewProduct({ name: "", barcode: "", category: "", quantity: 1, dispensa_id: "" });
      setExpiryDate(undefined);
      setIsAddDialogOpen(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const success = await importProducts(file);
      if (success) {
        setIsImportDialogOpen(false);
        e.target.value = "";
      }
    }
  };

  const handleQuickQuantityChange = (product: any, delta: number, e: React.MouseEvent) => {
    e.stopPropagation();
    updateQuantity(product, delta, setProducts);
  };

  const getExpiryBadge = (expiryDate: string | null) => {
    if (!expiryDate) return null;
    const expiry = new Date(expiryDate);
    const today = new Date();
    const daysUntilExpiry = differenceInDays(expiry, today);
    if (daysUntilExpiry < 0) return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Scaduto</Badge>;
    if (daysUntilExpiry <= 3) return <Badge variant="warning" className="gap-1"><Clock className="h-3 w-3" />Scade tra {daysUntilExpiry}g</Badge>;
    return <Badge variant="outline" className="text-xs">{format(expiry, "dd MMM yyyy", { locale: it })}</Badge>;
  };

  const getNutriscoreBg = (score: string) => {
    switch (score.toLowerCase()) {
      case 'a': return 'bg-green-600';
      case 'b': return 'bg-lime-500';
      case 'c': return 'bg-yellow-500';
      case 'd': return 'bg-orange-500';
      case 'e': return 'bg-red-600';
      default: return 'bg-muted';
    }
  };

  const getEcoscoreBg = (score: string) => {
    switch (score.toLowerCase()) {
      case 'a': return 'bg-green-600';
      case 'b': return 'bg-lime-500';
      case 'c': return 'bg-yellow-500';
      case 'd': return 'bg-orange-500';
      case 'e': return 'bg-red-600';
      default: return 'bg-muted';
    }
  };

  const toggleProductSelection = (productId: string) => {
    const newSelection = new Set(selectedProducts);
    newSelection.has(productId) ? newSelection.delete(productId) : newSelection.add(productId);
    setSelectedProducts(newSelection);
  };

  const toggleAllSelection = () => {
    selectedProducts.size === filteredProducts.length ? setSelectedProducts(new Set()) : setSelectedProducts(new Set(filteredProducts.map(p => p.id)));
  };

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        product.name?.toLowerCase().includes(searchLower) ||
        product.barcode?.toLowerCase().includes(searchLower) ||
        product.brand?.toLowerCase().includes(searchLower) ||
        product.allCategories.some((cat) => cat.toLowerCase().includes(searchLower));
      const matchesCategory = categoryFilter === "all" || product.allCategories.includes(categoryFilter);
      const matchesBrand = brandFilter === "all" || product.brand === brandFilter;
      return matchesSearch && matchesCategory && matchesBrand;
    });
  }, [products, searchQuery, categoryFilter, brandFilter]);

  const isColumnVisible = (key: ColumnKey) => visibleColumns.includes(key);

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {/* Alert Dialogs for Deletion */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare {selectedProducts.size} prodotti?</AlertDialogTitle>
            <AlertDialogDescription>L'azione è irreversibile.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => { deleteProducts(selectedProducts); setSelectedProducts(new Set()); setShowBulkDeleteDialog(false); }} className="bg-destructive text-white">Elimina tutti</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteProductId} onOpenChange={() => setDeleteProductId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questo prodotto?</AlertDialogTitle>
            <AlertDialogDescription>Verrà rimosso da tutte le dispense.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => { deleteProduct(deleteProductId!); setDeleteProductId(null); }} className="bg-destructive text-white">Elimina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2 text-foreground">Inventario</h1>
          <p className="text-muted-foreground">Gestisci i prodotti del gruppo {activeGroup?.name}</p>
        </div>
        <div className="flex gap-2">
          {selectedProducts.size > 0 && (
            <Button variant="destructive" onClick={() => setShowBulkDeleteDialog(true)} className="gap-2">
              <Trash2 className="h-4 w-4" /> ({selectedProducts.size})
            </Button>
          )}
          
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" />Aggiungi</Button></DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Nuovo Prodotto</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="barcode">Codice a barre *</Label>
                  <Input id="barcode" type="text" inputMode="numeric" placeholder="es. 8076800195057" value={newProduct.barcode} onChange={(e) => setNewProduct({ ...newProduct, barcode: e.target.value.replace(/\D/g, '') })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantità *</Label>
                    <Input id="quantity" type="number" min="1" value={newProduct.quantity} onChange={(e) => setNewProduct({ ...newProduct, quantity: parseInt(e.target.value) || 1 })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dispensa">Dispensa</Label>
                    <Select value={newProduct.dispensa_id} onValueChange={(value) => setNewProduct({ ...newProduct, dispensa_id: value })}>
                      <SelectTrigger><SelectValue placeholder="Nessuna" /></SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="none">Nessuna</SelectItem>
                        {dispense.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={handleAddProduct} disabled={isSubmitting} className="w-full">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aggiungi Prodotto"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Import Wizard Dialog */}
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <FileUp className="h-4 w-4" />
                Importa
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileUp className="h-5 w-5 text-primary" /> Importazione Avanzata
                </DialogTitle>
                <DialogDescription>
                  Carica un file per aggiungere prodotti e assegnarli automaticamente alle tue dispense.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6 py-4">
                <div className="bg-muted/50 p-4 rounded-lg border space-y-3">
                  <div className="flex gap-3">
                    <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <p className="text-sm font-semibold">Parametri supportati nel file:</p>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div className="flex gap-2">
                      <code className="font-bold text-primary">barcode</code> 
                      <span className="text-muted-foreground">(Obbligatorio)</span>
                    </div>
                    <div className="flex gap-2">
                      <code className="font-bold text-primary">dispensa_name</code> 
                      <span className="text-muted-foreground">(Es: "{dispense[0]?.name || "Cucina"}")</span>
                    </div>
                    <div className="flex gap-2"><code>name</code></div>
                    <div className="flex gap-2"><code>brand</code></div>
                    <div className="flex gap-2"><code>category</code></div>
                    <div className="flex gap-2"><code>quantity</code></div>
                    <div className="flex gap-2"><code>expiry_date</code> <span className="text-muted-foreground">(YYYY-MM-DD)</span></div>
                    <div className="flex gap-2"><code>origin</code></div>
                    <div className="flex gap-2"><code>nutriscore</code></div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-base">1. Scarica il template aggiornato</Label>
                  <p className="text-xs text-muted-foreground">Usa questi file come base per non commettere errori di formattazione.</p>
                  <div className="grid grid-cols-3 gap-3">
                    <Button variant="outline" onClick={() => handleDownloadTemplate('xlsx')} className="hover:bg-green-50 hover:text-green-700 hover:border-green-200">
                      <Download className="h-4 w-4 mr-2" /> Excel
                    </Button>
                    <Button variant="outline" onClick={() => handleDownloadTemplate('csv')} className="hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200">
                      <Download className="h-4 w-4 mr-2" /> CSV
                    </Button>
                    <Button variant="outline" onClick={() => handleDownloadTemplate('json')} className="hover:bg-orange-50 hover:text-orange-700 hover:border-orange-200">
                      <Download className="h-4 w-4 mr-2" /> JSON
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-base">2. Trascina o seleziona il file</Label>
                  <div 
                    className="border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center hover:bg-primary/5 hover:border-primary/50 transition-all cursor-pointer group"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input type="file" ref={fileInputRef} className="hidden" accept=".csv,.json,.xlsx,.xls" onChange={handleFileChange} />
                    {isImporting ? (
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        <div className="text-center">
                          <p className="font-semibold text-primary">Importazione in corso</p>
                          <p className="text-xs text-muted-foreground">Creazione prodotti e collegamenti dispense...</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                          <FileUp className="h-7 w-7 text-primary" />
                        </div>
                        <p className="font-bold text-lg">Pronto al caricamento</p>
                        <p className="text-sm text-muted-foreground text-center max-w-[250px] mt-1">
                          Se il nome della dispensa non esiste, il prodotto verrà aggiunto all'inventario generale.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5 text-primary" />Prodotti ({filteredProducts.length})</CardTitle>
            <div className="flex gap-3 w-full sm:w-auto flex-wrap">
              <div className="relative flex-1 sm:flex-initial sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Cerca prodotto..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[140px]"><Filter className="h-4 w-4 mr-2" /><SelectValue placeholder="Categoria" /></SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="all">Tutte</SelectItem>
                  {categories.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                </SelectContent>
              </Select>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="outline" size="icon"><Columns className="h-4 w-4" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover">
                  {ALL_COLUMNS.map((col) => (
                    <DropdownMenuCheckboxItem key={col.key} checked={isColumnVisible(col.key)} onCheckedChange={(checked) => {
                      setVisibleColumns(checked ? [...visibleColumns, col.key] : visibleColumns.filter((c) => c !== col.key));
                    }}>{col.label}</DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">Nessun prodotto</h3>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {isColumnVisible("select") && (
                      <TableHead className="w-12">
                        <Checkbox checked={selectedProducts.size === filteredProducts.length && filteredProducts.length > 0} onCheckedChange={toggleAllSelection} />
                      </TableHead>
                    )}
                    {isColumnVisible("image") && <TableHead className="w-16">Img</TableHead>}
                    {isColumnVisible("name") && <TableHead>Prodotto</TableHead>}
                    {isColumnVisible("brand") && <TableHead>Marca</TableHead>}
                    {isColumnVisible("quantity") && <TableHead>Quantità</TableHead>}
                    {isColumnVisible("expiry") && <TableHead>Scadenza</TableHead>}
                    {isColumnVisible("nutriscore") && <TableHead>Nutri</TableHead>}
                    {isColumnVisible("actions") && <TableHead className="text-right">Azioni</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => navigate(`/prodotti/${product.id}`)}>
                      {isColumnVisible("select") && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={selectedProducts.has(product.id)} onCheckedChange={() => toggleProductSelection(product.id)} />
                        </TableCell>
                      )}
                      {isColumnVisible("image") && <TableCell>{product.image_url ? <img src={product.image_url} alt="" className="h-10 w-10 rounded object-contain bg-white border" /> : <div className="h-10 w-10 rounded bg-muted flex items-center justify-center"><Package className="h-4 w-4 text-muted-foreground" /></div>}</TableCell>}
                      {isColumnVisible("name") && <TableCell className="font-medium max-w-[200px] truncate">{product.name || <span className="text-muted-foreground italic">Senza nome</span>}</TableCell>}
                      {isColumnVisible("brand") && <TableCell className="text-muted-foreground">{product.brand || "—"}</TableCell>}
                      {isColumnVisible("quantity") && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => handleQuickQuantityChange(product, -1, e)} disabled={product.totalQuantity === 0}><Minus className="h-3 w-3" /></Button>
                            <Badge variant={product.totalQuantity === 0 ? "outline" : "secondary"}>{product.totalQuantity}</Badge>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => handleQuickQuantityChange(product, 1, e)}><Plus className="h-3 w-3" /></Button>
                          </div>
                        </TableCell>
                      )}
                      {isColumnVisible("expiry") && <TableCell>{getExpiryBadge(product.nearestExpiry)}</TableCell>}
                      {isColumnVisible("nutriscore") && <TableCell>{product.nutriscore ? <Badge className={cn("uppercase font-bold text-white", getNutriscoreBg(product.nutriscore))}>{product.nutriscore}</Badge> : "—"}</TableCell>}
                      {isColumnVisible("actions") && <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/prodotti/${product.id}`); }}><Eye className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); setDeleteProductId(product.id); }}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Inventario;