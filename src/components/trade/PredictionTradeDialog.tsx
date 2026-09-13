import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { PredictionMarket, PredictionSide } from "@/lib/predictionMarkets";
import { toast } from "sonner";

// PredictionTradeDialog: buy YES/NO shares on a prediction market. Purely a
// UI mock — there is no backend endpoint for prediction markets (never has
// been; see predictionMarkets.ts) — "buying" here just shows a confirmation
// toast, the same honesty the rest of this file's sibling mock features use
// rather than pretending an order actually settled somewhere.
export function PredictionTradeDialog({
  market,
  side,
  onOpenChange,
}: {
  market: PredictionMarket;
  side: PredictionSide;
  onOpenChange: (open: boolean) => void;
}) {
  const [amount, setAmount] = useState("25");
  const priceCents = side === "YES" ? market.yesPct : 100 - market.yesPct;
  const cost = Number(amount) || 0;
  const shares = priceCents > 0 ? cost / (priceCents / 100) : 0;
  const potentialReturn = shares; // $1 per share if this side resolves true

  const confirm = () => {
    if (cost <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    toast.success(`Bought ${shares.toFixed(2)} ${side} shares`, {
      description: `${market.question} — ${cost} BI2XUSD at ${priceCents}¢/share`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-glass-border max-w-md">
        <DialogHeader>
          <DialogTitle>
            <span className={cn(side === "YES" ? "text-buy" : "text-sell")}>{side}</span>
            {" "}· {priceCents}¢
          </DialogTitle>
          <DialogDescription className="line-clamp-2">{market.question}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-muted-foreground">Amount (BI2XUSD)</label>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className="h-10 font-mono bg-muted/30"
            />
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {[10, 25, 50, 100].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmount(String(preset))}
                className="h-8 rounded-md border border-border/50 text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
              >
                {preset}
              </button>
            ))}
          </div>

          <div className="glass rounded-lg p-3 text-xs space-y-1.5">
            <div className="flex justify-between"><span className="text-muted-foreground">Shares</span><span className="font-mono">{shares.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Avg. price</span><span className="font-mono">{priceCents}¢</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">If {side} wins, you receive</span><span className="font-mono text-buy">${potentialReturn.toFixed(2)}</span></div>
          </div>

          <Button
            onClick={confirm}
            className={cn(
              "w-full h-10 font-bold",
              side === "YES" ? "bg-gradient-buy text-buy-foreground hover:shadow-glow-buy" : "bg-gradient-sell text-sell-foreground hover:shadow-glow-sell"
            )}
          >
            Buy {side}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
