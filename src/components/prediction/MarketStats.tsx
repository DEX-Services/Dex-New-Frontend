import { Activity, BarChart3, Users } from "lucide-react";
import { CountdownTimer } from "./CountdownTimer";
import { formatContractPrice, formatPredictionCurrency, formatPredictionVolume, type PredictionMarket } from "@/lib/predictionMarkets";
import type { PredictionIntervalState } from "@/lib/predictionSimulation";

export function MarketStats({ market, intervalState }: { market: PredictionMarket; intervalState?: PredictionIntervalState }) {
  const hasUnderlyingPrice = market.referencePrice !== undefined && market.currentPrice !== undefined;
  const delta = hasUnderlyingPrice ? market.currentPrice! - market.referencePrice! : 0;
  const leader = [...market.outcomes].sort((a, b) => b.price - a.price)[0];

  return (
    <section className="glass rounded-xl p-4 sm:p-5" aria-label="Market summary">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {hasUnderlyingPrice ? (
          <>
            <Stat label="Price to Beat" value={formatPredictionCurrency(market.referencePrice!, market.referencePrice! < 10 ? 4 : 2)} helper="Underlying reference" />
            <Stat label="Current Price" value={formatPredictionCurrency(market.currentPrice!, market.currentPrice! < 10 ? 4 : 2)} helper={`${delta >= 0 ? "+" : ""}${formatPredictionCurrency(delta)} vs target`} valueClass={delta >= 0 ? "text-buy" : "text-sell"} />
          </>
        ) : (
          <>
            <Stat label="Leading Outcome" value={leader.label} helper={`${formatContractPrice(leader.price)} contract price`} valueClass={leader.tone === "positive" ? "text-buy" : "text-sell"} />
            <Stat label="Implied Probability" value={`${Math.round(leader.price * 100)}%`} helper="Approximate market view" />
          </>
        )}
        <div className="space-y-1"><div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{intervalState === "UPCOMING" ? "Starts In" : "Countdown"}</div><CountdownTimer endTime={intervalState === "UPCOMING" ? market.startTime : market.endTime} /></div>
        <div className="grid grid-cols-1 gap-2 text-xs">
          <span className="flex items-center justify-between gap-2 text-muted-foreground"><BarChart3 className="h-3.5 w-3.5 text-primary" />Volume <b className="font-mono font-medium text-foreground">{formatPredictionVolume(market.volume)}</b></span>
          <span className="flex items-center justify-between gap-2 text-muted-foreground"><Users className="h-3.5 w-3.5 text-primary" />Traders <b className="font-mono font-medium text-foreground">{market.participants.toLocaleString()}</b></span>
          <span className="flex items-center justify-between gap-2 text-muted-foreground"><Activity className="h-3.5 w-3.5 text-primary" />Source <b className="max-w-32 truncate font-medium text-foreground" title={market.priceSource}>{market.priceSource}</b></span>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, helper, valueClass = "" }: { label: string; value: string; helper: string; valueClass?: string }) {
  return <div><div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div><div className={`mt-1 font-mono text-xl font-bold sm:text-2xl ${valueClass}`}>{value}</div><div className="mt-1 text-[10px] text-muted-foreground">{helper}</div></div>;
}
