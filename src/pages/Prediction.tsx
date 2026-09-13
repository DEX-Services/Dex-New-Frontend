import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Timer, Users, TrendingUp, ClipboardList } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  PREDICTION_MARKETS,
  PREDICTION_CATEGORIES,
  CATEGORY_BADGE_CLASS,
  type PredictionMarket,
  type PredictionSide,
} from "@/lib/predictionMarkets";
import { PredictionTradeDialog } from "@/components/trade/PredictionTradeDialog";

export default function Prediction() {
  const navigate = useNavigate();
  const [category, setCategory] = useState<(typeof PREDICTION_CATEGORIES)[number]>("All");
  const [trade, setTrade] = useState<{ market: PredictionMarket; side: PredictionSide } | null>(null);

  useEffect(() => {
    document.title = "Prediction Markets | BitDx";
  }, []);

  const markets = category === "All" ? PREDICTION_MARKETS : PREDICTION_MARKETS.filter((m) => m.category === category);

  return (
    <AppShell>
      {trade && (
        <PredictionTradeDialog
          market={trade.market}
          side={trade.side}
          onOpenChange={(open) => !open && setTrade(null)}
        />
      )}
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <TrendingUp className="h-7 w-7 text-primary" /> Prediction Markets
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Trade on the outcome of real-world events. Buy YES or NO shares — each pays $1 if it resolves
              in your favor, $0 otherwise.
            </p>
          </div>
          <Button variant="outline" className="gap-2 shrink-0" onClick={() => navigate("/prediction/orders")}>
            <ClipboardList className="h-4 w-4" /> My Orders
          </Button>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none flex-nowrap">
          {PREDICTION_CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                "px-3 py-1.5 text-xs rounded-md border transition-all shrink-0",
                category === c ? "bg-primary/15 text-primary border-primary/30" : "border-border/50 text-muted-foreground hover:bg-muted/40"
              )}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {markets.map((m) => (
            <MarketCard key={m.id} market={m} onTrade={(side) => setTrade({ market: m, side })} />
          ))}
        </div>

        <p className="text-xs text-muted-foreground max-w-2xl">
          Prediction markets are a preview feature — prices and volumes shown are illustrative, and orders
          placed here are not yet settled against a real market maker.
        </p>
      </div>
    </AppShell>
  );
}

function MarketCard({ market, onTrade }: { market: PredictionMarket; onTrade: (side: PredictionSide) => void }) {
  return (
    <div className="glass rounded-xl p-5 flex flex-col gap-3 hover:border-primary/40 transition-all duration-200 hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-2">
        <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0.5", CATEGORY_BADGE_CLASS[market.category])}>
          {market.category}
        </Badge>
        <span className="text-[10px] text-muted-foreground flex items-center gap-1 shrink-0">
          <Timer className="h-2.5 w-2.5" /> {market.closes}
        </span>
      </div>

      <div className="text-sm font-semibold min-h-[2.5rem] leading-snug">{market.question}</div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Vol {market.volume}</span>
        <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {market.participants.toLocaleString()}</span>
      </div>

      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-gradient-to-r from-buy to-buy/70 transition-all duration-700" style={{ width: `${market.yesPct}%` }} />
      </div>
      <div className="flex justify-between text-[11px]">
        <span className="text-buy font-bold">YES {market.yesPct}¢</span>
        <span className="text-sell font-bold">NO {100 - market.yesPct}¢</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" onClick={() => onTrade("YES")} className="bg-buy/15 text-buy hover:bg-buy/25 border border-buy/30 h-8 text-xs">
          YES
        </Button>
        <Button size="sm" onClick={() => onTrade("NO")} className="bg-sell/15 text-sell hover:bg-sell/25 border border-sell/30 h-8 text-xs">
          NO
        </Button>
      </div>
    </div>
  );
}
