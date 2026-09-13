import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { PREDICTION_ORDERS, orderStatusBadgeClass, sidePillClass } from "@/lib/predictionMarkets";

export default function PredictionOrders() {
  useEffect(() => {
    document.title = "Prediction Orders | BitDx";
  }, []);

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardList className="h-7 w-7 text-primary" /> Prediction Orders
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Your prediction market positions and history.</p>
        </div>

        {PREDICTION_ORDERS.length === 0 ? (
          <div className="glass rounded-xl p-10 text-center text-muted-foreground">No orders yet.</div>
        ) : (
          <div className="glass rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-2 text-[10px] uppercase tracking-wide text-muted-foreground border-b border-glass-border">
              <div>Market</div>
              <div>Side</div>
              <div>Shares / Cost</div>
              <div>Status</div>
            </div>
            {PREDICTION_ORDERS.map((order) => (
              <div
                key={order.id}
                className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-3 items-center border-b border-glass-border last:border-b-0"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{order.question}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">{order.id} · {order.placedAt}</div>
                </div>
                <div>
                  <span className={sidePillClass(order.side)}>{order.side}</span>
                </div>
                <div className="text-right text-xs font-mono">
                  <div>{order.shares.toFixed(2)} @ {order.priceCents}¢</div>
                  <div className="text-muted-foreground">${order.cost.toFixed(2)}</div>
                </div>
                <div>
                  <Badge variant="outline" className={cn("text-[10px]", orderStatusBadgeClass(order.status))}>
                    {order.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
