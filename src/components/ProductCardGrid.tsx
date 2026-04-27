import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Package, Trash2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProductWithDetails } from "@/hooks/useInventoryData";

interface ProductCardGridProps {
  products: ProductWithDetails[];
  onProductClick: (id: string) => void;
  onDelete?: (id: string) => void;
  selectable?: boolean;
  selected?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

export function ProductCardGrid({
  products,
  onProductClick,
  onDelete,
  selectable,
  selected,
  onToggleSelect,
}: ProductCardGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
      {products.map((p) => {
        const qty = p.totalQuantity > 0 ? p.totalQuantity : (p.displayQuantity ?? 1);
        const isSelected = selected?.has(p.id);
        return (
          <Card
            key={p.id}
            className={cn(
              "relative group overflow-hidden cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5",
              isSelected && "ring-2 ring-primary"
            )}
            onClick={() => onProductClick(p.id)}
          >
            {selectable && onToggleSelect && (
              <div
                className="absolute top-2 left-2 z-10 bg-background/80 backdrop-blur rounded p-0.5"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelect(p.id);
                }}
              >
                <Checkbox checked={isSelected} />
              </div>
            )}

            <Badge
              variant="secondary"
              className="absolute top-2 right-2 z-10 font-bold shadow"
            >
              x{qty}
            </Badge>

            <div className="aspect-square bg-white flex items-center justify-center p-3 border-b">
              {p.image_url ? (
                <img
                  src={p.image_url}
                  alt={p.name || ""}
                  className="max-h-full max-w-full object-contain"
                  loading="lazy"
                />
              ) : (
                <Package className="h-10 w-10 text-muted-foreground/40" />
              )}
            </div>

            <div className="p-2.5 space-y-1">
              <p className="font-medium text-sm line-clamp-2 leading-tight min-h-[2.5rem]">
                {p.name || <span className="text-muted-foreground italic">Senza nome</span>}
              </p>
              <div className="flex items-center justify-between gap-1 text-xs text-muted-foreground">
                <span className="truncate">{p.brand || "—"}</span>
                {p.origin && (
                  <span className="flex items-center gap-0.5 shrink-0">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate max-w-[60px]">{p.origin}</span>
                  </span>
                )}
              </div>
            </div>

            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute bottom-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(p.id);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </Card>
        );
      })}
    </div>
  );
}
