import { useState } from "react";
import { MobileScanner } from "@/components/MobileScanner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScanLine, Camera, Zap, Hand } from "lucide-react";

const Scan = () => {
  const [open, setOpen] = useState(true);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/60 shadow-glow">
          <ScanLine className="h-7 w-7 text-primary-foreground" />
        </div>
        <h1 className="text-3xl font-bold">Scanner mobile</h1>
        <p className="text-muted-foreground">
          Usa la fotocamera del telefono per aggiungere o rimuovere prodotti dalle tue dispense.
        </p>
      </div>

      <Card className="p-6 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <Zap className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-sm">Tap rapido</p>
              <p className="text-xs text-muted-foreground">Ogni codice scansionato aggiunge +1 alla dispensa.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Hand className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-sm">Tieni premuto</p>
              <p className="text-xs text-muted-foreground">Apre il pannello per scegliere quantità e azione.</p>
            </div>
          </div>
        </div>

        <Button size="lg" className="w-full" onClick={() => setOpen(true)}>
          <Camera className="h-5 w-5 mr-2" />
          Apri scanner
        </Button>
      </Card>

      <MobileScanner open={open} onOpenChange={setOpen} />
    </div>
  );
};

export default Scan;
