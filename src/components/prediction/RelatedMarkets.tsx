import { Link } from "react-router-dom";
import { ArrowRight, Layers3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PREDICTION_MARKETS, formatContractPrice, type PredictionMarket } from "@/lib/predictionMarkets";
import { CountdownTimer } from "./CountdownTimer";

export function RelatedMarkets({ market }: { market: PredictionMarket }) {
  const related = market.relatedMarketIds.map((id) => PREDICTION_MARKETS.find((item) => item.id === id)).filter((item): item is PredictionMarket => Boolean(item));
  if (related.length === 0) return null;

  return (
    <section className="glass overflow-hidden rounded-xl" aria-labelledby="related-markets-title">
      <div className="flex items-center gap-2 border-b border-border/50 px-4 py-3"><Layers3 className="h-4 w-4 text-primary" /><h2 id="related-markets-title" className="font-semibold">Related markets</h2></div>
      <div className="divide-y divide-border/40">
        {related.map((item) => {
          const leader = [...item.outcomes].sort((a, b) => b.price - a.price)[0];
          return <Link key={item.id} to={`/prediction/${item.id}`} className="group flex items-center gap-3 p-3 transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary">
            <span className="flex h-9 min-w-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 px-1 font-mono text-[9px] font-bold text-primary">{item.icon}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{item.shortTitle}</span><span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground"><span className={cn(leader.tone === "positive" ? "text-buy" : "text-sell")}>{leader.label} {formatContractPrice(leader.price)}</span><span>·</span><CountdownTimer endTime={item.endTime} compact /></span></span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </Link>;
        })}
      </div>
    </section>
  );
}
