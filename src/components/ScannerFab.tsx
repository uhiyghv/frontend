import { useState } from "react";
import { ScanLine } from "lucide-react";
import { MobileScanner } from "@/components/MobileScanner";
import { cn } from "@/lib/utils";

interface ScannerFabProps {
  defaultDispensaId?: string;
  onScanComplete?: () => void;
  className?: string;
}

/**
 * Floating action button that opens the mobile camera scanner.
 * Visible only on small screens (md:hidden) — on desktop the header / sidebar entries cover it.
 */
export function ScannerFab({ defaultDispensaId, onScanComplete, className }: ScannerFabProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label="Scansiona prodotto"
        onClick={() => setOpen(true)}
        className={cn(
          "md:hidden fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full",
          "bg-gradient-to-br from-primary to-primary/70 text-primary-foreground",
          "shadow-glow flex items-center justify-center",
          "active:scale-95 transition-transform",
          className,
        )}
      >
        <ScanLine className="h-6 w-6" />
      </button>
      <MobileScanner
        open={open}
        onOpenChange={setOpen}
        defaultDispensaId={defaultDispensaId}
        onScanComplete={onScanComplete}
      />
    </>
  );
}
