import { useOrders } from "@/lib/useOrders";
import { formatPrice } from "@/lib/mockData";
import { X } from "lucide-react";
import { toast } from "sonner";

interface OpenOrdersProps {
  orders: ReturnType<typeof useOrders>;
  backendMarket: { symbol: string; market: string } | null;
}

export function OpenOrders({ orders, backendMarket }: OpenOrdersProps) {
  const handleCancel = async (symbol: string, market: string, orderId: string) => {
    try {
      await orders.cancel(symbol, market, orderId);
      toast.success("Order cancelled");
    } catch (err) {
      toast.error("Cancel failed", { description: err instanceof Error ? err.message : String(err) });
    }
  };

  if (orders.orders.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
        {backendMarket ? "No open orders" : "Live orders unavailable for this market"}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col text-[11px] font-mono overflow-hidden min-h-0">
      <div className="grid grid-cols-5 gap-1 px-2 py-1 text-[9px] text-muted-foreground uppercase border-b border-border/50 shrink-0">
        <span>Side</span>
        <span className="text-right">Price</span>
        <span className="text-right">Qty</span>
        <span className="text-right">Filled</span>
        <span className="text-right">Cancel</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {orders.orders.map((o) => (
          <div key={o.id} className="grid grid-cols-5 gap-1 px-2 py-1 items-center hover:bg-muted/20">
            <span className={o.side === "BUY" ? "text-buy" : "text-sell"}>{o.side}</span>
            <span className="text-right">{o.price ? formatPrice(Number(o.price)) : "MKT"}</span>
            <span className="text-right">{o.qty}</span>
            <span className="text-right text-muted-foreground">{o.filled}</span>
            <button
              onClick={() => handleCancel(o.symbol, o.market, o.id)}
              className="ml-auto flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
              aria-label="Cancel order"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
