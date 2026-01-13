// pages/Inventario.tsx
import { useState, useMemo } from "react";
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
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
import { Search, Filter, Plus, Package, Loader2, Eye, Trash2, Columns, Warehouse, CalendarIcon, Minus, Clock, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveGroup } from "@/contexts/ActiveGroupContext";
import { useNotificationContext } from "@/contexts/NotificationContext";
import { format, differenceInDays } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useInventoryData } from "@/hooks/useInventoryData";
import { useProductActions } from "@/hooks/useProductActions.ts";

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
  
  const { products, setProducts, dispense, categories, brands, isLoading, refetch } = useInventoryData(user?.id, activeGroup?.id);
  const { addProduct, deleteProduct, deleteProducts, updateQuantity, isSubmitting } = useProductActions(user?.id, activeGroup?.id, refetch, addLocalNotification);

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(["select", "image", "name", "brand", "category", "dispensa", "quantity", "expiry", "actions"]);
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [expiryDate, setExpiryDate] = useState<Date | undefined>();
  const [newProduct, setNewProduct] = useState({
    name: "", barcode: "", category: "", quantity: 1, dispensa_id: "",
  });

  const handleAddProduct = async () => {
    const success = await addProduct(newProduct, expiryDate);
    if (success) {
      setNewProduct({ name: "", barcode: "", category: "", quantity: 1, dispensa_id: "" });
      setExpiryDate(undefined);
      setIsAddDialogOpen(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!deleteProductId) return;
    await deleteProduct(deleteProductId);
    setDeleteProductId(null);
  };

  const handleBulkDelete = async () => {
    const success = await deleteProducts(selectedProducts);
    if (success) {
      setSelectedProducts(new Set());
      setShowBulkDeleteDialog(false);
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
    
    if (daysUntilExpiry < 0) {
      return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Scaduto</Badge>;
    } else if (daysUntilExpiry <= 3) {
      return <Badge variant="warning" className="gap-1"><Clock className="h-3 w-3" />Scade tra {daysUntilExpiry}g</Badge>;
    } else if (daysUntilExpiry <= 7) {
      return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />{format(expiry, "dd MMM", { locale: it })}</Badge>;
    }
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
    if (newSelection.has(productId)) {
      newSelection.delete(productId);
    } else {
      newSelection.add(productId);
    }
    setSelectedProducts(newSelection);
  };

  const toggleAllSelection = () => {
    if (selectedProducts.size === filteredProducts.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(filteredProducts.map(p => p.id)));
    }
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

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare {selectedProducts.size} prodotti?</AlertDialogTitle>
            <AlertDialogDescription>Questa azione è irreversibile. I prodotti verranno rimossi da tutte le dispense.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Elimina tutti</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteProductId} onOpenChange={() => setDeleteProductId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questo prodotto?</AlertDialogTitle>
            <AlertDialogDescription>Questa azione è irreversibile. Il prodotto verrà rimosso da tutte le dispense.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProduct} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Elimina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Inventario</h1>
          <p className="text-muted-foreground">Gestisci tutti i prodotti del gruppo</p>
        </div>
        <div className="flex gap-2">
          {selectedProducts.size > 0 && (
            <Button variant="destructive" onClick={() => setShowBulkDeleteDialog(true)} className="gap-2">
              <Trash2 className="h-4 w-4" />
              Elimina ({selectedProducts.size})
            </Button>
          )}
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" />Aggiungi Prodotto</Button></DialogTrigger>
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
                <div className="space-y-2">
                  <Label>Data di scadenza</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !expiryDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {expiryDate ? format(expiryDate, "PPP", { locale: it }) : "Seleziona data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-popover" align="start">
                      <Calendar mode="single" selected={expiryDate} onSelect={setExpiryDate} initialFocus disabled={(date) => date < new Date()} />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Categoria (opzionale)</Label>
                  <Input id="category" placeholder="es. Pasta" value={newProduct.category} onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Nome (opzionale)</Label>
                  <Input id="name" placeholder="es. Pasta Barilla 500g" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} />
                </div>
                <Button onClick={handleAddProduct} disabled={isSubmitting} className="w-full">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aggiungi Prodotto"}
                </Button>
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
              <Select value={brandFilter} onValueChange={setBrandFilter}>
                <SelectTrigger className="w-[120px]"><SelectValue placeholder="Marca" /></SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="all">Tutte</SelectItem>
                  {brands.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
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
              <p className="mb-4">Inizia aggiungendo il tuo primo prodotto</p>
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
                    {isColumnVisible("barcode") && <TableHead>Codice a barre</TableHead>}
                    {isColumnVisible("category") && <TableHead>Categoria</TableHead>}
                    {isColumnVisible("dispensa") && <TableHead>Dispensa</TableHead>}
                    {isColumnVisible("quantity") && <TableHead>Quantità</TableHead>}
                    {isColumnVisible("expiry") && <TableHead>Scadenza</TableHead>}
                    {isColumnVisible("origin") && <TableHead>Origine</TableHead>}
                    {isColumnVisible("nutriscore") && <TableHead>Nutri-Score</TableHead>}
                    {isColumnVisible("ecoscore") && <TableHead>Eco-Score</TableHead>}
                    {isColumnVisible("nova") && <TableHead>NOVA</TableHead>}
                    {isColumnVisible("date") && <TableHead>Data creazione</TableHead>}
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
                      {isColumnVisible("name") && <TableCell className="font-medium">{product.name || <span className="text-muted-foreground italic">Senza nome</span>}</TableCell>}
                      {isColumnVisible("brand") && <TableCell className="text-muted-foreground">{product.brand || "—"}</TableCell>}
                      {isColumnVisible("barcode") && <TableCell><code className="text-xs bg-muted px-2 py-1 rounded">{product.barcode || "—"}</code></TableCell>}
                      {isColumnVisible("category") && <TableCell>{product.allCategories.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-xs">{product.allCategories.slice(0, 2).map((cat) => <Badge key={cat} variant="secondary" className="text-xs">{cat}</Badge>)}{product.allCategories.length > 2 && <Badge variant="outline" className="text-xs">+{product.allCategories.length - 2}</Badge>}</div>
                      ) : "—"}</TableCell>}
                      {isColumnVisible("dispensa") && <TableCell>{product.dispensaNames.length > 0 ? (
                        <div className="flex flex-wrap gap-1">{product.dispensaNames.map((name) => <Badge key={name} variant="outline" className="text-xs"><Warehouse className="h-3 w-3 mr-1" />{name}</Badge>)}</div>
                      ) : <span className="text-muted-foreground">—</span>}</TableCell>}
                      {isColumnVisible("quantity") && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {product.dispensaProducts.length > 0 ? (
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => handleQuickQuantityChange(product, -1, e)} disabled={product.totalQuantity === 0}>
                                <Minus className="h-3 w-3" />
                              </Button>
                              <Badge variant={product.totalQuantity === 0 ? "outline" : "secondary"} className="min-w-[40px] justify-center">
                                {product.totalQuantity}
                              </Badge>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => handleQuickQuantityChange(product, 1, e)}>
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <Badge variant="secondary" className="min-w-[40px] justify-center">1</Badge>
                          )}
                        </TableCell>
                      )}
                      {isColumnVisible("expiry") && <TableCell>{getExpiryBadge(product.nearestExpiry)}</TableCell>}
                      {isColumnVisible("origin") && <TableCell className="text-muted-foreground text-sm">{product.origin || "—"}</TableCell>}
                      {isColumnVisible("nutriscore") && <TableCell>{product.nutriscore ? <Badge className={cn("uppercase font-bold text-white", getNutriscoreBg(product.nutriscore))}>{product.nutriscore}</Badge> : "—"}</TableCell>}
                      {isColumnVisible("ecoscore") && <TableCell>{product.ecoscore ? <Badge className={cn("uppercase font-bold text-white", getEcoscoreBg(product.ecoscore))}>{product.ecoscore}</Badge> : "—"}</TableCell>}
                      {isColumnVisible("nova") && <TableCell>{product.nova_group ? <Badge variant="outline" className="font-bold">{product.nova_group}</Badge> : "—"}</TableCell>}
                      {isColumnVisible("date") && <TableCell className="text-muted-foreground">{new Date(product.created_at).toLocaleDateString('it-IT')}</TableCell>}
                      {isColumnVisible("actions") && <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/prodotti/${product.id}`); }}><Eye className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive" onClick={(e) => { e.stopPropagation(); setDeleteProductId(product.id); }}><Trash2 className="h-4 w-4" /></Button>
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