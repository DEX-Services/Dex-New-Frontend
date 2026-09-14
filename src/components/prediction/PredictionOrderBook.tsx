import { useMemo, useState } from "react";
import { BookOpen, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { calculateBookSpread, calculateCumulativeBookLevels, formatContractPrice, formatPredictionCurrency, type PredictionCumulativeBookLevel, type PredictionMarket } from "@/lib/predictionMarkets";

export function PredictionOrderBook({ market, initialOutcomeId }: { market: PredictionMarket; initialOutcomeId: string }) {
  const [selectedOutcomeId, setSelectedOutcomeId] = useState(initialOutcomeId);
  const selectedOutcome = market.outcomes.find((outcome) => outcome.id === selectedOutcomeId) ?? market.outcomes[0];
  const book = market.orderBooks.find((item) => item.outcomeId === selectedOutcome.id) ?? { outcomeId: selectedOutcome.id, bids: [], asks: [], lastPrice: selectedOutcome.price };
  const asks = useMemo(() => calculateCumulativeBookLevels([...book.asks].sort((a, b) => b.price - a.price)), [book.asks]);
  const bids = useMemo(() => calculateCumulativeBookLevels([...book.bids].sort((a, b) => b.price - a.price)), [book.bids]);
  const spread = calculateBookSpread(book);

  return (
    <section className="glass overflow-hidden rounded-xl" aria-labelledby="prediction-orderbook-title">
      <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div><div className="flex items-center gap-1.5"><BookOpen className="h-4 w-4 text-primary" /><h2 id="prediction-orderbook-title" className="font-semibold">Order Book</h2><Info className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" /></div><p className="mt-0.5 text-[10px] text-muted-foreground">Illustrative contract liquidity</p></div>
        <div className="grid grid-cols-2 rounded-lg bg-muted/40 p-1" role="tablist" aria-label="Order book outcome">
          {market.outcomes.map((outcome) => <button key={outcome.id} type="button" role="tab" aria-selected={selectedOutcome.id === outcome.id} onClick={() => setSelectedOutcomeId(outcome.id)} className={cn("h-8 rounded-md px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", selectedOutcome.id === outcome.id ? outcome.tone === "positive" ? "bg-buy/15 text-buy" : "bg-sell/15 text-sell" : "text-muted-foreground hover:text-foreground")}>Trade {outcome.label}</button>)}
        </div>
      </div>

      {asks.length === 0 && bids.length === 0 ? <div className="p-10 text-center text-sm text-muted-foreground">No orders are available for this outcome.</div> : <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] table-fixed text-xs"><caption className="sr-only">Mock order book for {selectedOutcome.label}</caption><thead><tr className="border-b border-border/50 text-[10px] uppercase tracking-wider text-muted-foreground"><th className="px-4 py-2 text-left">Price</th><th className="px-4 py-2 text-right">Shares</th><th className="px-4 py-2 text-right">Total</th></tr></thead><tbody>
          {asks.map((level, index) => <BookRow key={`ask-${level.price}-${index}`} level={level} side="ask" />)}
          <tr className="border-y border-border/50 bg-muted/30"><td colSpan={3} className="px-4 py-2"><div className="flex items-center justify-between"><span>Last: <b className="font-mono text-foreground">{formatContractPrice(book.lastPrice)}</b></span><span className="text-muted-foreground">Spread: <b className="font-mono text-foreground">{formatContractPrice(spread)}</b></span></div></td></tr>
          {bids.map((level, index) => <BookRow key={`bid-${level.price}-${index}`} level={level} side="bid" />)}
        </tbody></table>
      </div>}
    </section>
  );
}

function BookRow({ level, side }: { level: PredictionCumulativeBookLevel; side: "bid" | "ask" }) {
  return <tr className="relative border-b border-border/20 last:border-b-0"><td className="relative px-4 py-2.5"><span className={cn("relative z-10 font-mono font-semibold", side === "bid" ? "text-buy" : "text-sell")}>{formatContractPrice(level.price)}</span><span aria-hidden="true" className={cn("absolute inset-y-0 left-0", side === "bid" ? "bg-buy/10" : "bg-sell/10")} style={{ width: `${level.depthPercent}%` }} /></td><td className="px-4 py-2.5 text-right font-mono">{level.shares.toFixed(2)}</td><td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{formatPredictionCurrency(level.total)}</td></tr>;
}
