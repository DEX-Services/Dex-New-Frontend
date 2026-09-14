import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PredictionMarketCard } from "@/components/prediction/PredictionMarketCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PREDICTION_CATEGORIES, PREDICTION_MARKETS } from "@/lib/predictionMarkets";

const DURATION_FILTERS = [
  { value: "ALL", label: "All durations" },
  { value: 5, label: "5 Min" },
  { value: 15, label: "15 Min" },
] as const;
type DurationFilter = (typeof DURATION_FILTERS)[number]["value"];

export default function Prediction() {
  const navigate = useNavigate();
  const [category, setCategory] = useState<(typeof PREDICTION_CATEGORIES)[number]>("All");
  const [duration, setDuration] = useState<DurationFilter>("ALL");

  useEffect(() => {
    document.title = "Prediction Markets | BitDx";
  }, []);

  const markets = PREDICTION_MARKETS.filter((market) =>
    (category === "All" || market.category === category)
    && (duration === "ALL" || market.intervalMinutes === duration),
  );

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight"><TrendingUp className="h-7 w-7 text-primary" />Prediction Markets</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Trade on the outcome of real-world events. Buy YES, NO, UP, or DOWN shares — each winning share pays $1 and each losing share pays $0.</p>
          </div>
          <Button variant="outline" className="shrink-0 gap-2" onClick={() => navigate("/prediction/orders")}><ClipboardList className="h-4 w-4" />My Orders</Button>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-nowrap items-center gap-2 overflow-x-auto scrollbar-none" aria-label="Prediction market categories">
            {PREDICTION_CATEGORIES.map((item) => (
              <button key={item} type="button" aria-pressed={category === item} onClick={() => setCategory(item)} className={cn(filterClass, category === item ? selectedFilterClass : unselectedFilterClass)}>{item}</button>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-2" aria-label="Prediction market duration">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Duration</span>
            {DURATION_FILTERS.map((item) => (
              <button key={String(item.value)} type="button" aria-pressed={duration === item.value} onClick={() => setDuration(item.value)} className={cn(filterClass, duration === item.value ? selectedFilterClass : unselectedFilterClass)}>{item.label}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {markets.map((market) => <PredictionMarketCard key={market.id} market={market} />)}
        </div>

        {markets.length === 0 && <div className="glass rounded-xl p-10 text-center text-sm text-muted-foreground">No markets match this category and duration.</div>}

        <p className="max-w-2xl text-xs text-muted-foreground">Prediction markets are a preview feature. Prices, depth, positions, and volumes are illustrative; demo orders are not sent to a backend or blockchain.</p>
      </main>
    </AppShell>
  );
}

const filterClass = "shrink-0 rounded-md border px-3 py-1.5 text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const selectedFilterClass = "border-primary/30 bg-primary/15 text-primary";
const unselectedFilterClass = "border-border/50 text-muted-foreground hover:bg-muted/40";
