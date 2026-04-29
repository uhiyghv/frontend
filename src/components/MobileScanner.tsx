import { useEffect, useRef, useState, useCallback } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { DecodeHintType, BarcodeFormat } from "@zxing/library";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Camera,
  Plus,
  Minus,
  Sparkles,
  ScanLine,
  X,
  CheckCircle2,
  Package,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveGroup } from "@/contexts/ActiveGroupContext";
import { useAuth } from "@/contexts/AuthContext";
import { appToast } from "@/lib/toast";
import { cn } from "@/lib/utils";

interface Dispensa {
  id: string;
  name: string;
  color: string | null;
  group_id: string | null;
}

interface MobileScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDispensaId?: string;
  onScanComplete?: () => void;
}

interface PendingScan {
  barcode: string;
}
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

export function MobileScanner({
  open,
  onOpenChange,
  defaultDispensaId,
  onScanComplete,
}: MobileScannerProps) {
  const { user } = useAuth();
  const { activeGroup } = useActiveGroup();

  // Refs per logica interna
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const lastScanRef = useRef<{ code: string; ts: number }>({ code: "", ts: 0 });
  const isLongPressRef = useRef(false);
  const selectedDispensaIdRef = useRef<string>("");
  const busyRef = useRef(false);
  const longPressTimer = useRef<number | null>(null);

  // State
  const [dispense, setDispense] = useState<Dispensa[]>([]);
  // Inizializzato a stringa vuota per evitare l'errore "controlled vs uncontrolled"
  const [selectedDispensaId, setSelectedDispensaId] = useState<string>(
    defaultDispensaId ?? "",
  );
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingScan, setPendingScan] = useState<PendingScan | null>(null);
  const [confirmQty, setConfirmQty] = useState(1);
  const [scanCount, setScanCount] = useState(0);
  const [flash, setFlash] = useState<SuccessFlash | null>(null);
  const [pulse, setPulse] = useState(false);

  // Sincronizza i ref per evitare letture stale nelle callback asincrone
  useEffect(() => {
    selectedDispensaIdRef.current = selectedDispensaId;
  }, [selectedDispensaId]);
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  // Caricamento dispense (Ottimizzato: rimosso selectedDispensaId dalle dipendenze)
  useEffect(() => {
    if (!open || defaultDispensaId || !user) return;
    (async () => {
      console.log("[Scanner] Caricamento dispense...");
      let q = supabase.from("dispense").select("id, name, color, group_id");
      if (activeGroup) {
        q = q.or(
          `group_id.eq.${activeGroup.id},and(user_id.eq.${user.id},group_id.is.null)`,
        );
      } else {
        q = q.eq("user_id", user.id);
      }
      const { data } = await q.order("name");
      const list = data ?? [];
      setDispense(list);

      if (!selectedDispensaId && list.length > 0) {
        const saved = localStorage.getItem("mobileScanner.dispensaId");
        const found = saved && list.find((d) => d.id === saved);
        setSelectedDispensaId(found ? saved : list[0].id);
      }
    })();
  }, [open, defaultDispensaId, user, activeGroup]);

  // Invio scansione al database
  const submitScan = useCallback(
    async (barcode: string, action: "add" | "remove", quantity: number) => {
      const dispensaId = selectedDispensaIdRef.current;
      if (!dispensaId) {
        appToast.warning("Seleziona prima una dispensa");
        return;
      }
      setBusy(true);
      try {
        const { data, error } = await supabase.functions.invoke(
          "mobile-scan-product",
          {
            body: { barcode, dispensa_id: dispensaId, action, quantity },
          },
        );

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        setScanCount((c) => c + 1);
        setPulse(true);
        setTimeout(() => setPulse(false), 600);

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
        setTimeout(
          () => setFlash((curr) => (curr?.id === flashItem.id ? null : curr)),
          2500,
        );

        onScanComplete?.();
      } catch (e: any) {
        console.error("[Scanner] Errore invio:", e);
        appToast.error("Errore", {
          description: e.message || "Scansione fallita",
        });
      } finally {
        setBusy(false);
      }
    },
    [onScanComplete],
  );

  // Gestione rilevamento codice
  const handleDetected = useCallback(
    (barcode: string) => {
      const code = barcode.trim();
      if (!code || busyRef.current) return;

      const now = Date.now();
      if (
        lastScanRef.current.code === code &&
        now - lastScanRef.current.ts < SCAN_COOLDOWN_MS
      )
        return;
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

  // AVVIO FOTOCAMERA - Logica robusta
  useEffect(() => {
    if (!open) return;

    let isMounted = true;
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.CODE_128,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);

    const reader = new BrowserMultiFormatReader(hints);

    const startCamera = async () => {
      // Aspettiamo un tick per assicurarci che il ref video esista
      await new Promise((r) => setTimeout(r, 100));
      if (!videoRef.current || !isMounted) return;

      try {
        console.log("[Scanner] Richiesta permessi e avvio...");
        const constraints: MediaStreamConstraints = {
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        };

        const controls = await reader.decodeFromConstraints(
          constraints,
          videoRef.current,
          (result) => {
            if (result && isMounted) handleDetected(result.getText());
          },
        );

        if (!isMounted) {
          controls.stop();
          return;
        }

        controlsRef.current = controls;
        setCameraReady(true);
        console.log("[Scanner] Camera avviata correttamente.");
      } catch (err: any) {
        console.error("[Scanner] Errore camera:", err);
        if (isMounted) setCameraError("Permesso negato o camera non trovata.");
      }
    };

    startCamera();

    return () => {
      isMounted = false;
      console.log("[Scanner] Spegnimento camera...");
      if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
      }
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, [open, handleDetected]);

  // Modalità manuale (Pressione prolungata)
  const startLongPress = () => {
    longPressTimer.current = window.setTimeout(() => {
      isLongPressRef.current = true;
      if (navigator.vibrate) navigator.vibrate([30, 30, 30]);
      appToast.info("Modalità manuale attiva");
    }, 500);
  };

  const endLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    setTimeout(() => {
      isLongPressRef.current = false;
    }, 300);
  };

  const handleClose = () => {
    onOpenChange(false);
    setScanCount(0);
    setFlash(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg p-0 overflow-hidden sm:rounded-2xl border-none">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <ScanLine className="h-5 w-5 text-primary" />
              Scanner
            </DialogTitle>
            <DialogDescription>
              Inquadra un codice a barre per aggiungerlo.
            </DialogDescription>
          </DialogHeader>

          {!defaultDispensaId && (
            <div className="px-4 pb-3">
              <Select
                value={selectedDispensaId}
                onValueChange={setSelectedDispensaId}
              >
                <SelectTrigger className="w-full bg-muted/50 border-none">
                  <SelectValue placeholder="Scegli dispensa" />
                </SelectTrigger>
                <SelectContent>
                  {dispense.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ background: d.color || "#ccc" }}
                        />
                        {d.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div
            className="relative bg-black aspect-[4/5] sm:aspect-video overflow-hidden"
            onPointerDown={startLongPress}
            onPointerUp={endLongPress}
          >
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              playsInline
              muted
            />

            {/* Overlay feedback visivo */}
            <div
              className={cn(
                "absolute inset-0 transition-opacity duration-300 pointer-events-none",
                pulse ? "bg-primary/20 opacity-100" : "opacity-0",
              )}
            />

            {/* Mirino */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-48 border-2 border-primary/50 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                <div
                  className={cn(
                    "absolute inset-x-0 h-0.5 bg-primary/80 top-1/2",
                    cameraReady && "animate-pulse",
                  )}
                />
              </div>
            </div>

            {/* Stato Caricamento / Errore */}
            {!cameraReady && !cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-black/80 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium">Avvio fotocamera...</p>
              </div>
            )}

            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-black/90 p-6 text-center gap-4">
                <Camera className="h-10 w-10 text-destructive" />
                <p className="text-sm">{cameraError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.reload()}
                >
                  Ricarica pagina
                </Button>
              </div>
            )}

            {/* Success Card */}
            {flash && (
              <div className="absolute bottom-4 left-4 right-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="bg-background/95 backdrop-blur shadow-xl border p-3 rounded-xl flex items-center gap-3">
                  <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                    {flash.productImage ? (
                      <img
                        src={flash.productImage}
                        className="object-cover h-full w-full"
                      />
                    ) : (
                      <Package className="text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">
                      {flash.productName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Totale: {flash.newQuantity}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "text-lg font-black",
                      flash.action === "add"
                        ? "text-green-500"
                        : "text-red-500",
                    )}
                  >
                    {flash.action === "add" ? "+" : "-"}
                    {flash.delta}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 flex items-center justify-between bg-muted/30">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3" />
              <span>{scanCount} prodotti aggiunti</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleClose}>
              Chiudi
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual Selection Sheet */}
      <Sheet
        open={!!pendingScan}
        onOpenChange={(o) => !o && setPendingScan(null)}
      >
        <SheetContent side="bottom" className="rounded-t-3xl p-6">
          <SheetHeader className="mb-4">
            <SheetTitle>Conferma quantità</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-6 py-4">
            <div className="flex items-center justify-center gap-6">
              <Button
                variant="outline"
                size="icon"
                className="h-14 w-14 rounded-full"
                onClick={() => setConfirmQty((q) => Math.max(1, q - 1))}
              >
                <Minus />
              </Button>
              <span className="text-4xl font-bold w-12 text-center">
                {confirmQty}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-14 w-14 rounded-full"
                onClick={() => setConfirmQty((q) => q + 1)}
              >
                <Plus />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="secondary"
                className="h-12"
                onClick={() => {
                  submitScan(pendingScan!.barcode, "remove", confirmQty);
                  setPendingScan(null);
                }}
              >
                Rimuovi
              </Button>
              <Button
                className="h-12"
                onClick={() => {
                  submitScan(pendingScan!.barcode, "add", confirmQty);
                  setPendingScan(null);
                }}
              >
                Aggiungi
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
