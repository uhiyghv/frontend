import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  Area,
  AreaChart,
} from "recharts";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Package,
  Warehouse,
  Calendar,
  Loader2,
  AlertTriangle,
  Apple,
  Leaf,
  Activity,
  Globe,
} from "lucide-react";
import { supabase } from "@/integrations/backend/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveGroup } from "@/contexts/ActiveGroupContext";
import { format, subDays, startOfDay, endOfDay, eachDayOfInterval } from "date-fns";
import { it } from "date-fns/locale";

interface ScanLog {
  id: string;
  action: string;
  quantity: number;
  created_at: string;
  dispensa_id: string;
  product_id: string;
}

interface CategoryCount {
  name: string;
  value: number;
}

interface DailyActivity {
  date: string;
  additions: number;
  removals: number;
}

interface DispenseStock {
  name: string;
  quantity: number;
  color: string;
}

interface LowStockItem {
  productName: string;
  dispensaName: string;
  quantity: number;
  threshold: number;
}

interface ProductDetails {
  id: string;
  category: string;
  nutriscore: string;
  ecoscore: string;
  nova_group: number;
  origin: string;
}

const SCORE_COLORS: Record<string, string> = {
  a: "#1e8f4e", b: "#85bb2f", c: "#ffcc00", d: "#ef8200", e: "#e63e11",
  "1": "#1e8f4e", "2": "#85bb2f", "3": "#ffcc00", "4": "#e63e11"
};

const generateColor = (index: number, total: number) => {
  const hue = (index * (360 / Math.max(total, 1))) % 360;
  return `hsl(${hue}, 70%, 55%)`;
};

const Grafici = () => {
  const { user } = useAuth();
  const { activeGroup } = useActiveGroup();
  const [isLoading, setIsLoading] = useState(true);
  const [scanLogs, setScanLogs] = useState<ScanLog[]>([]);
  const [categories, setCategories] = useState<CategoryCount[]>([]);
  const [dispenseStock, setDispenseStock] = useState<DispenseStock[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [dateRange, setDateRange] = useState("7");
  const [products, setProducts] = useState<ProductDetails[]>([]);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [allDispense, setAllDispense] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (user && activeGroup) fetchData();
  }, [user, activeGroup, dateRange]);

  const fetchData = async () => {
    if (!user || !activeGroup) return;
    setIsLoading(true);

    try {
      const daysAgo = parseInt(dateRange);
      const startDate = subDays(new Date(), daysAgo).toISOString();

      // Fetch scan logs
      const { data: logsData } = await supabase
        .from("scan_logs")
        .select("*")
        .gte("created_at", startDate)
        .order("created_at", { ascending: true });

      setScanLogs(logsData || []);

      // Fetch products with categories for this group
      const { data: productsData } = await supabase
        .from("products")
        .select("id, category, nutriscore, ecoscore, nova_group, origin")
        .eq("group_id", activeGroup.id);
      setProducts(productsData || []);

      // Fetch product categories
      const { data: productCategoriesData } = await supabase
        .from("product_categories")
        .select("product_id, category_name");

      // Build category counts
      const catCounts: Record<string, number> = {};
      const uniqueCategories = new Set<string>();

      productsData?.forEach((p) => {
        if (p.category) {
          catCounts[p.category] = (catCounts[p.category] || 0) + 1;
          uniqueCategories.add(p.category);
        }
      });

      productCategoriesData?.forEach((pc) => {
        catCounts[pc.category_name] = (catCounts[pc.category_name] || 0) + 1;
        uniqueCategories.add(pc.category_name);
      });

      setCategories(
        Object.entries(catCounts)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 10)
      );
      setAllCategories(Array.from(uniqueCategories).sort());

      // Fetch dispense with stock for this group
      const { data: dispenseData } = await supabase
        .from("dispense")
        .select("id, name, color")
        .eq("group_id", activeGroup.id);

      setAllDispense(dispenseData?.map((d) => ({ id: d.id, name: d.name })) || []);

      const { data: dispenseProductsData } = await supabase
        .from("dispense_products")
        .select("dispensa_id, quantity");

      const stockByDispensa: Record<string, number> = {};
      dispenseProductsData?.forEach((dp) => {
        stockByDispensa[dp.dispensa_id] = (stockByDispensa[dp.dispensa_id] || 0) + dp.quantity;
      });

      setDispenseStock(
        (dispenseData || []).map((d, idx, arr) => ({
          name: d.name,
          quantity: stockByDispensa[d.id] || 0,
          color: d.color || generateColor(idx, arr.length) ,
        }))
      );

      // Fetch low stock items
      const { data: lowStockData } = await supabase
        .from("dispense_products")
        .select(`
          quantity,
          threshold,
          products:product_id (name),
          dispense:dispensa_id (name)
        `)
        .lte("quantity", 5);

      const lowItems: LowStockItem[] = (lowStockData || [])
        .filter((item: any) => item.quantity <= (item.threshold || 2))
        .map((item: any) => ({
          productName: item.products?.name || "Senza nome",
          dispensaName: item.dispense?.name || "Sconosciuta",
          quantity: item.quantity,
          threshold: item.threshold || 2,
        }));

      setLowStockItems(lowItems);
    } catch (error) {
      console.error("Error fetching analytics data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Compute daily activity
  const dailyActivity = useMemo(() => {
    const daysAgo = parseInt(dateRange);
    const startDate = startOfDay(subDays(new Date(), daysAgo));
    const endDate = endOfDay(new Date());

    const days = eachDayOfInterval({ start: startDate, end: endDate });
    const activityMap: Record<string, { additions: number; removals: number }> = {};

    days.forEach((day) => {
      const key = format(day, "yyyy-MM-dd");
      activityMap[key] = { additions: 0, removals: 0 };
    });

    scanLogs.forEach((log) => {
      const key = format(new Date(log.created_at), "yyyy-MM-dd");
      if (activityMap[key]) {
        if (log.action === "add") {
          activityMap[key].additions += log.quantity;
        } else {
          activityMap[key].removals += log.quantity;
        }
      }
    });

    return Object.entries(activityMap).map(([date, data]) => ({
      date: format(new Date(date), "dd MMM", { locale: it }),
      additions: data.additions,
      removals: data.removals,
    }));
  }, [scanLogs, dateRange]);

  // Summary stats
  const stats = useMemo(() => {
    const totalAdditions = scanLogs
      .filter((l) => l.action === "add")
      .reduce((sum, l) => sum + l.quantity, 0);
    const totalRemovals = scanLogs
      .filter((l) => l.action === "remove")
      .reduce((sum, l) => sum + l.quantity, 0);
    const totalStock = dispenseStock.reduce((sum, d) => sum + d.quantity, 0);

    return { totalAdditions, totalRemovals, totalStock };
  }, [scanLogs, dispenseStock]);

   // --- LOGICA DEI DATI ---
  const nutriData = useMemo(() => {
    const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
    products.forEach(p => {
      const score = p.nutriscore?.toUpperCase();
      if (score && counts[score] !== undefined) counts[score]++;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [products]);

  const ecoData = useMemo(() => {
    const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
    products.forEach(p => {
      const score = p.ecoscore?.toUpperCase();
      if (score && counts[score] !== undefined) counts[score]++;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [products]);

  const novaData = useMemo(() => {
    const counts: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0 };
    products.forEach(p => {
      const score = String(p.nova_group);
      if (counts[score] !== undefined) counts[score]++;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [products]);

  const originData = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach(p => {
      const origin = p.origin || "Sconosciuta";
      counts[origin] = (counts[origin] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [products]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Grafici & Statistiche</h1>
          <p className="text-muted-foreground">
            Analizza l'attività e le tendenze del tuo inventario
          </p>
        </div>

        <div className="flex gap-3">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[150px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="7">Ultimi 7 giorni</SelectItem>
              <SelectItem value="30">Ultimi 30 giorni</SelectItem>
              <SelectItem value="90">Ultimi 90 giorni</SelectItem>
              <SelectItem value="365">Ultimo anno</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-success/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Prodotti Aggiunti</p>
                <p className="text-2xl font-bold">{stats.totalAdditions}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-warning/10 flex items-center justify-center">
                <TrendingDown className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Prodotti Rimossi</p>
                <p className="text-2xl font-bold">{stats.totalRemovals}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Stock Totale</p>
                <p className="text-2xl font-bold">{stats.totalStock}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

            {/* Row 1: Health & Sustainability */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Nutri-Score Chart */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Apple className="h-4 w-4 text-green-500"/> Nutri-Score</CardTitle></CardHeader>
          <CardContent className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={nutriData}>
                <XAxis dataKey="name" hide />
                <Tooltip cursor={{fill: 'transparent'}} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {nutriData.map((entry) => (
                    <Cell key={entry.name} fill={SCORE_COLORS[entry.name.toLowerCase()] || "#ccc"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Eco-Score Chart */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Leaf className="h-4 w-4 text-emerald-500"/> Eco-Score</CardTitle></CardHeader>
          <CardContent className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={ecoData} innerRadius={30} outerRadius={50} dataKey="value">
                  {ecoData.map((entry) => (
                    <Cell key={entry.name} fill={SCORE_COLORS[entry.name.toLowerCase()] || "#ccc"} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* NOVA Group */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4 text-blue-500"/> Processazione NOVA</CardTitle></CardHeader>
          <CardContent className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={novaData} layout="vertical">
                <YAxis dataKey="name" type="category" width={20} tick={{fontSize: 10}} />
                <XAxis type="number" hide />
                <Tooltip />
                <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Origins */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Globe className="h-4 w-4 text-orange-500"/> Top Origini</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {originData.map((item, i) => (
                <div key={i} className="flex justify-between text-xs border-b pb-1">
                  <span>{item.name}</span>
                  <span className="font-bold">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Over Time */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Attività nel Tempo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyActivity}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="additions"
                    name="Aggiunti"
                    stackId="1"
                    stroke="hsl(var(--success))"
                    fill="hsl(var(--success))"
                    fillOpacity={0.3}
                  />
                  <Area
                    type="monotone"
                    dataKey="removals"
                    name="Rimossi"
                    stackId="2"
                    stroke="hsl(var(--warning))"
                    fill="hsl(var(--warning))"
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Products by Category */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Prodotti per Categoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {categories.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Nessuna categoria trovata
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categories}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => 
                        percent > 0.05 ? `${name.slice(0, 15)}${name.length > 15 ? '...' : ''} (${(percent * 100).toFixed(0)}%)` : ''
                      }
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {categories.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={generateColor(index, categories.length)} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stock by Dispensa */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Warehouse className="h-5 w-5 text-primary" />
              Stock per Dispensa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {dispenseStock.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Nessuna dispensa trovata
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dispenseStock} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      tick={{ fontSize: 12 }}
                      width={100}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="quantity" name="Quantità" radius={[0, 4, 4, 0]}>
                      {dispenseStock.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Prodotti in Esaurimento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] overflow-auto">
              {lowStockItems.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Nessun prodotto in esaurimento</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {lowStockItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-lg bg-warning/5 border border-warning/20"
                    >
                      <div>
                        <p className="font-medium">{item.productName}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.dispensaName}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge
                          variant={item.quantity === 0 ? "destructive" : "warning"}
                        >
                          {item.quantity} / {item.threshold}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Grafici;
