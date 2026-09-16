import { useMemo, useState } from "react";
import { CircleDollarSign, Info, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { placePredictionOrder, type PredictionSide as ApiSide } from "@/lib/predictionApi";
import { calculateBuyEstimate, formatContractPrice, formatPredictionCurrency, getPredictionOutcome, type PredictionMarket } from "@/lib/predictionMarkets";

export function TradeTicket({ market, selectedOutcomeId, onSelectOutcome, disabledReason, onOrderPlaced }: {
  market: PredictionMarket;
  selectedOutcomeId: string;
  onSelectOutcome: (id: string) => void;
  disabledReason?: string;
  onOrderPlaced?: () => void;
}) {
  const [input, setInput] = useState("25");
  const [submitting, setSubmitting] = useState(false);
  const outcome = getPredictionOutcome(market, selectedOutcomeId);
  const estimate = useMemo(() => calculateBuyEstimate(input, outcome.price), [input, outcome.price]);
  const valid = estimate.shares > 0 && !disabledReason && market.windowId !== null;

  const submit = async () => {
    if (!valid || !market.windowId) return;
    setSubmitting(true);
    try {
      const side: ApiSide = outcome.id === "yes" ? "YES" : "NO";
      const result = await placePredictionOrder(market.windowId, side.toLowerCase() as "yes" | "no", outcome.price.toFixed(2), estimate.shares.toFixed(6));
      if (result.status === "filled") {
        toast.success("Order filled", { description: `Bought ${Number(result.filledSize).toFixed(2)} ${outcome.label} shares.` });
      } else if (Number(result.filledSize) > 0) {
        toast.success("Order partially filled", { description: `Filled ${Number(result.filledSize).toFixed(2)} of ${estimate.shares.toFixed(2)} ${outcome.label} shares; the rest is resting on the book.` });
      } else {
        toast.success("Order placed", { description: `${outcome.label} order resting on the book — no matching liquidity yet.` });
      }
      onOrderPlaced?.();
    } catch (err) {
      toast.error("Order failed", { description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="glass-strong overflow-hidden rounded-xl" aria-labelledby="trade-ticket-title">
      <div className="border-b border-border/50 p-4"><div className="flex items-center justify-between gap-2"><div><p className="text-[10px] font-semibold uppercase tracking-wider text-primary">Prediction contract</p><h2 id="trade-ticket-title" className="mt-1 font-semibold">{market.shortTitle}</h2></div></div></div>
      <div className="space-y-4 p-4">
        <div><div className="mb-2 flex items-center justify-between text-xs"><span className="font-medium">Choose outcome</span><Tooltip><TooltipTrigger asChild><button type="button" aria-label="What contract prices mean" className="text-muted-foreground hover:text-primary"><Info className="h-3.5 w-3.5" /></button></TooltipTrigger><TooltipContent className="max-w-xs text-xs">A winning share resolves to $1. A losing share resolves to $0.</TooltipContent></Tooltip></div><div className="grid grid-cols-2 gap-2">
          {market.outcomes.map((item) => <button key={item.id} type="button" aria-pressed={outcome.id === item.id} onClick={() => onSelectOutcome(item.id)} className={cn("flex h-12 items-center justify-between rounded-lg border px-3 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", outcome.id === item.id ? item.tone === "positive" ? "border-buy/50 bg-buy/15 text-buy shadow-[0_0_16px_hsl(var(--buy)/0.12)]" : "border-sell/50 bg-sell/15 text-sell shadow-[0_0_16px_hsl(var(--sell)/0.12)]" : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40")}><span>{item.label}</span><span className="font-mono">{formatContractPrice(item.price)}</span></button>)}
        </div></div>

        <div><div className="mb-1.5 flex items-center justify-between"><label htmlFor="prediction-trade-value" className="text-xs font-medium">Amount (BI2XUSD)</label></div><div className="relative"><Input id="prediction-trade-value" value={input} onChange={(event) => setInput(event.target.value)} inputMode="decimal" placeholder="0.00" className="h-11 bg-muted/30 pr-20 font-mono" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">BI2XUSD</span></div></div>

        <div className="grid grid-cols-3 gap-2">{[5, 25, 100].map((amount) => <button key={amount} type="button" onClick={() => setInput(String(amount))} className="h-10 rounded-lg border border-border/60 bg-muted/20 font-mono text-xs font-bold transition-colors hover:border-primary/40 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">${amount}</button>)}</div>

        <div className="space-y-2 rounded-lg border border-border/50 bg-muted/20 p-3 text-xs">
          <EstimateRow label="Contract price" value={formatContractPrice(outcome.price)} />
          <EstimateRow label="Estimated shares" value={estimate.shares.toFixed(2)} />
          <EstimateRow label="Maximum payout" value={formatPredictionCurrency(estimate.payout)} />
          <EstimateRow label="Potential profit" value={formatPredictionCurrency(estimate.profit)} highlight />
          <EstimateRow label="Taker fee (0.045%)" value={formatPredictionCurrency(estimate.amount * 0.00045)} />
        </div>

        <Button type="button" onClick={submit} disabled={!valid || submitting} className={cn("h-11 w-full font-bold", outcome.tone === "positive" ? "bg-gradient-buy text-buy-foreground hover:shadow-glow-buy" : "bg-gradient-sell text-sell-foreground hover:shadow-glow-sell")}>
          {disabledReason ?? (submitting ? "Placing order…" : <><CircleDollarSign className="h-4 w-4" />{`Buy ${outcome.label}`}</>)}
        </Button>
        <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-muted-foreground"><WalletCards className="mt-0.5 h-3 w-3 shrink-0" />Orders are matched against real users — there is no market maker. An order may fill partially or rest unfilled if there isn't enough opposing liquidity.</p>
      </div>
    </section>
  );
}

function EstimateRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return <div className="flex items-center justify-between"><span className="text-muted-foreground">{label}</span><span className={cn("font-mono font-medium", highlight && "text-buy")}>{value}</span></div>;
}
