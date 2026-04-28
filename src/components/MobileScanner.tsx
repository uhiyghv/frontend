import { useEffect, useRef, useState, useCallback } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { DecodeHintType, BarcodeFormat } from "@zxing/library";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Camera, Plus, Minus, Sparkles, ScanLine, X, CheckCircle2, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveGroup } from "@/contexts/ActiveGroupContext";
import { useAuth } from "@/contexts/AuthContext";
import { appToast } from "@/lib/toast";
import { cn } from "@/lib/utils";

interface Dispensa { id: string; name: string; color: string | null; group_id: string | null; }

interface MobileScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDispensaId?: string;
  onScanComplete?: () => void;
}

interface PendingScan { barcode: string; }
interface SuccessFlash {
  id: number;
  productName: string;
  productImage: string | null;
  productBrand: string | null;
  newQuantity: number;
  delta: number;
  action: "add" | "remove";
}

const SCAN_COOLDOWN_MS = 1800;

export function MobileScanner({ open, onOpenChange, defaultDispensaId, onScanComplete }: MobileScannerProps) {
  const { user } = useAuth();
  const { activeGroup } = useActiveGroup();
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const lastScanRef = useRef<{ code: string; ts: number }>({ code: "", ts: 0 });
  const longPressTimer = useRef<number | null>(null);
  const isLongPressRef = useRef(false);
  const selectedDispensaIdRef = useRef<string | null>(null);
  const busyRef = useRef(false);

  const [dispense, setDispense] = useState<Dispensa[]>([]);
  const [selectedDispensaId, setSelectedDispensaId] = useState<string | null>(defaultDispensaId ?? null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingScan, setPendingScan] = useState<PendingScan | null>(null);
  const [confirmQty, setConfirmQty] = useState(1);
  const [scanCount, setScanCount] = useState(0);
  const [flash, setFlash] = useState<SuccessFlash | null>(null);
  const [pulse, setPulse] = useState(false);

  // Keep refs in sync so the camera callback never reads stale state
  useEffect(() => { selectedDispensaIdRef.current = selectedDispensaId; }, [selectedDispensaId]);
  useEffect(() => { busyRef.current = busy; }, [busy]);

  // Load pantries when no default
  useEffect(() => {
    if (!open || defaultDispensaId || !user) return;
    (async () => {
      let q = supabase.from("dispense").select("id, name, color, group_id");
      if (activeGroup) {
        q = q.or(`group_id.eq.${activeGroup.id},and(user_id.eq.${user.id},group_id.is.null)`);
      } else {
        q = q.eq("user_id", user.id);
      }
      const { data } = await q.order("name");
      setDispense(data ?? []);
      if (!selectedDispensaId && data && data.length > 0) {
        const saved = localStorage.getItem("mobileScanner.dispensaId");
        const found = saved && data.find((d) => d.id === saved);
        setSelectedDispensaId(found ? saved : data[0].id);
      }
    })();
  }, [open, defaultDispensaId, user, activeGroup, selectedDispensaId]);

  useEffect(() => {
    if (defaultDispensaId) setSelectedDispensaId(defaultDispensaId);
  }, [defaultDispensaId]);

  useEffect(() => {
    if (selectedDispensaId && !defaultDispensaId) {
      localStorage.setItem("mobileScanner.dispensaId", selectedDispensaId);
    }
  }, [selectedDispensaId, defaultDispensaId]);

  const submitScan = useCallback(
    async (barcode: string, action: "add" | "remove", quantity: number) => {
      const dispensaId = selectedDispensaIdRef.current;
      if (!dispensaId) {
        appToast.warning("Seleziona prima una dispensa");
        return;
      }
      setBusy(true);
      try {
        const { data, error } = await supabase.functions.invoke("mobile-scan-product", {
          body: { barcode, dispensa_id: dispensaId, action, quantity },
        });

        // Supabase invoke wraps non-2xx into `error` but body is in `data` only on 2xx.
        // Try to extract a real message from FunctionsHttpError.
        if (error) {
          let msg = error.message || "Errore di rete";
          const ctx = (error as unknown as { context?: Response }).context;
          if (ctx && typeof ctx.json === "function") {
            try {
              const body = await ctx.json();
              if (body?.error) msg = body.error;
            } catch { /* noop */ }
          }
          throw new Error(msg);
        }
        if (data?.error) throw new Error(data.error);

        setScanCount((c) => c + 1);
        setPulse(true);
        window.setTimeout(() => setPulse(false), 600);

        const flashItem: SuccessFlash = {
          id: Date.now(),
          productName: data?.productName ?? "Prodotto",
          productImage: data?.productImage ?? null,
          productBrand: data?.productBrand ?? null,
          newQuantity: data?.newQuantity ?? 0,
          delta: quantity,
          action,
        };
        setFlash(flashItem);
        window.setTimeout(() => {
          setFlash((current) => (current?.id === flashItem.id ? null : current));
        }, 2200);

        appToast.scan(
          `${action === "add" ? "+" : "−"}${quantity} · ${flashItem.productName}`,
          { description: `Totale in dispensa: ${flashItem.newQuantity}`, duration: 2500 },
        );
        onScanComplete?.();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Errore sconosciuto";
        appToast.error("Scansione fallita", { description: msg });
        if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
      } finally {
        setBusy(false);
      }
    },
    [onScanComplete],
  );

  const handleDetected = useCallback(
    (barcode: string) => {
      const code = barcode.trim();
      if (!code) return;
      const now = Date.now();
      if (busyRef.current) return;
      if (lastScanRef.current.code === code && now - lastScanRef.current.ts < SCAN_COOLDOWN_MS) return;
      lastScanRef.current = { code, ts: now };

      if (navigator.vibrate) navigator.vibrate(40);

      if (isLongPressRef.current) {
        setPendingScan({ barcode: code });
        setConfirmQty(1);
      } else {
        submitScan(code, "add", 1);
      }
    },
    [submitScan],
  );

  // Camera lifecycle — mount once per open, NOT per handleDetected change
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setCameraReady(false);
    setCameraError(null);

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.QR_CODE,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);
    const reader = new BrowserMultiFormatReader(hints);
    readerRef.current = reader;

    (async () => {
      try {
        if (!videoRef.current) return;
        // Prefer rear camera
        const constraints: MediaStreamConstraints = {
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        };
        const controls = await reader.decodeFromConstraints(
          constraints,
          videoRef.current,
          (result) => {
            if (cancelled) return;
            if (result) handleDetected(result.getText());
          },
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setCameraReady(true);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Impossibile accedere alla fotocamera";
        setCameraError(msg);
      }
    })();

    return () => {
      cancelled = true;
      try { controlsRef.current?.stop(); } catch { /* noop */ }
      // Force-stop tracks (zxing sometimes leaves them open)
      const v = videoRef.current;
      if (v?.srcObject instanceof MediaStream) {
        v.srcObject.getTracks().forEach((t) => t.stop());
        v.srcObject = null;
      }
      controlsRef.current = null;
      readerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Long-press handlers on viewfinder
  const startLongPress = () => {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      isLongPressRef.current = true;
      if (navigator.vibrate) navigator.vibrate([30, 30, 30]);
      appToast.info("Modalità conferma attiva", { description: "Tieni premuto e scansiona", duration: 1500 });
    }, 500);
  };
  const endLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setTimeout(() => { isLongPressRef.current = false; }, 300);
  };

  const handleClose = () => {
    onOpenChange(false);
    setScanCount(0);
    setFlash(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg p-0 overflow-hidden gap-0 sm:rounded-2xl">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <ScanLine className="h-5 w-5 text-primary" />
              Scansiona prodotto
            </DialogTitle>
            <DialogDescription>
              Tap = +1 rapido · Tieni premuto = scegli quantità e azione
            </DialogDescription>
          </DialogHeader>

          {!defaultDispensaId && (
            <div className="px-4 pb-2">
              <Label className="text-xs text-muted-foreground mb-1 block">Dispensa</Label>
              <Select value={selectedDispensaId ?? undefined} onValueChange={setSelectedDispensaId}>
                <SelectTrigger><SelectValue placeholder="Seleziona dispensa" /></SelectTrigger>
                <SelectContent>
                  {dispense.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: d.color || "hsl(var(--primary))" }} />
                        {d.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div
            className="relative bg-black aspect-[3/4] sm:aspect-video select-none"
            onPointerDown={startLongPress}
            onPointerUp={endLongPress}
            onPointerLeave={endLongPress}
            onPointerCancel={endLongPress}
          >
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              playsInline
              muted
              autoPlay
            />

            {/* Success pulse flash overlay */}
            <div
              className={cn(
                "absolute inset-0 pointer-events-none transition-opacity duration-500",
                pulse ? "opacity-100" : "opacity-0",
              )}
              style={{
                background: "radial-gradient(circle at center, hsl(var(--success)/0.55), transparent 70%)",
              }}
            />

            {/* Reticle */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className={cn(
                "w-[78%] h-1/3 border-2 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] relative overflow-hidden transition-colors",
                pulse ? "border-[hsl(var(--success))]" : "border-primary/80",
              )}>
                {/* corner accents */}
                <span className="absolute top-0 left-0 w-5 h-5 border-l-4 border-t-4 border-primary rounded-tl-2xl" />
                <span className="absolute top-0 right-0 w-5 h-5 border-r-4 border-t-4 border-primary rounded-tr-2xl" />
                <span className="absolute bottom-0 left-0 w-5 h-5 border-l-4 border-b-4 border-primary rounded-bl-2xl" />
                <span className="absolute bottom-0 right-0 w-5 h-5 border-r-4 border-b-4 border-primary rounded-br-2xl" />
                <div className={cn(
                  "absolute inset-x-0 h-0.5 bg-primary/90",
                  cameraReady ? "animate-[scan_2s_ease-in-out_infinite]" : "top-1/2",
                )} />
              </div>
            </div>

            {!cameraReady && !cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white/90 gap-2">
                <Loader2 className="h-6 w-6 animate-spin" />
                <p className="text-sm">Avvio fotocamera…</p>
              </div>
            )}
            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-6 text-center gap-3">
                <Camera className="h-8 w-8 text-destructive" />
                <p className="text-sm">{cameraError}</p>
                <p className="text-xs text-white/70">Concedi i permessi della fotocamera nelle impostazioni del browser.</p>
              </div>
            )}

            {/* Top overlays */}
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-white text-xs z-10">
              <span className="px-2 py-1 rounded-full bg-black/50 backdrop-blur-sm flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> {scanCount} scansionati
              </span>
              {busy && (
                <span className="px-2 py-1 rounded-full bg-black/50 backdrop-blur-sm flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Salvataggio…
                </span>
              )}
            </div>

            {/* Success card popup */}
            {flash && (
              <div className="absolute bottom-3 left-3 right-3 z-20 animate-[fade-in_0.25s_ease-out]">
                <div className="rounded-2xl bg-background/95 backdrop-blur-md border border-[hsl(var(--success)/0.4)] shadow-2xl p-3 flex items-center gap-3">
                  <div className="relative h-12 w-12 rounded-xl bg-muted overflow-hidden flex items-center justify-center shrink-0">
                    {flash.productImage ? (
                      <img src={flash.productImage} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Package className="h-6 w-6 text-muted-foreground" />
                    )}
                    <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-[hsl(var(--success))] text-white text-[10px] font-bold flex items-center justify-center shadow-md">
                      <CheckCircle2 className="h-3 w-3" />
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{flash.productName}</p>
                    {flash.productBrand && (
                      <p className="text-[11px] text-muted-foreground truncate">{flash.productBrand}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      "text-lg font-bold leading-none",
                      flash.action === "add" ? "text-[hsl(var(--success))]" : "text-[hsl(var(--destructive))]",
                    )}>
                      {flash.action === "add" ? "+" : "−"}{flash.delta}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">tot {flash.newQuantity}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground flex-1">
              Inquadra il codice. Le scansioni si aggiungono automaticamente.
            </p>
            <Button variant="outline" size="sm" onClick={handleClose}>
              <X className="h-4 w-4 mr-1" /> Chiudi
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Sheet open={!!pendingScan} onOpenChange={(o) => !o && setPendingScan(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Conferma scansione</SheetTitle>
            <SheetDescription>
              Codice <span className="font-mono">{pendingScan?.barcode}</span>
            </SheetDescription>
          </SheetHeader>
          <div className="py-6 space-y-5">
            <div>
              <Label className="text-xs text-muted-foreground">Quantità</Label>
              <div className="flex items-center gap-3 mt-2">
                <Button variant="outline" size="icon" onClick={() => setConfirmQty((q) => Math.max(1, q - 1))}>
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={confirmQty}
                  onChange={(e) => setConfirmQty(Math.max(1, Math.min(1000, parseInt(e.target.value) || 1)))}
                  className="text-center text-lg font-semibold"
                />
                <Button variant="outline" size="icon" onClick={() => setConfirmQty((q) => Math.min(1000, q + 1))}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={async () => {
                  if (!pendingScan) return;
                  await submitScan(pendingScan.barcode, "remove", confirmQty);
                  setPendingScan(null);
                }}
                disabled={busy}
              >
                <Minus className="h-4 w-4 mr-1" /> Rimuovi
              </Button>
              <Button
                onClick={async () => {
                  if (!pendingScan) return;
                  await submitScan(pendingScan.barcode, "add", confirmQty);
                  setPendingScan(null);
                }}
                disabled={busy}
              >
                <Plus className="h-4 w-4 mr-1" /> Aggiungi
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
