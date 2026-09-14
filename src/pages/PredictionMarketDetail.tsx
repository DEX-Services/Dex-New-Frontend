import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { MarketHeader } from "@/components/prediction/MarketHeader";
import { MarketInformation } from "@/components/prediction/MarketInformation";
import { MarketIntervalSelector } from "@/components/prediction/MarketIntervalSelector";
import { MarketPriceChart } from "@/components/prediction/MarketPriceChart";
import { MarketStats } from "@/components/prediction/MarketStats";
import { PredictionOrderBook } from "@/components/prediction/PredictionOrderBook";
import { RelatedMarkets } from "@/components/prediction/RelatedMarkets";
import { TradeTicket, type MockPredictionPositions } from "@/components/prediction/TradeTicket";
import { useLivePredictionMarket } from "@/hooks/useLivePredictionMarket";
import { findPredictionMarket, getPredictionOutcome, type PredictionMarket } from "@/lib/predictionMarkets";

export default function PredictionMarketDetail() {
  const { marketId } = useParams<{ marketId: string }>();
  const baseMarket = useMemo(() => findPredictionMarket(marketId), [marketId]);

  if (!baseMarket) {
    return <AppShell><main className="mx-auto flex min-h-[70vh] max-w-lg items-center p-6 text-center"><div className="glass w-full rounded-xl p-8"><AlertTriangle className="mx-auto h-9 w-9 text-warning" /><h1 className="mt-3 text-xl font-bold">Prediction market not found</h1><p className="mt-2 text-sm text-muted-foreground">This market may have been removed or the link is incorrect.</p><Button asChild className="mt-5"><Link to="/prediction"><ArrowLeft className="h-4 w-4" />Back to markets</Link></Button></div></main></AppShell>;
  }

  return <PredictionMarketDetailContent baseMarket={baseMarket} />;
}

function PredictionMarketDetailContent({ baseMarket }: { baseMarket: PredictionMarket }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const intervalParam = searchParams.get("interval");
  const parsedInterval = intervalParam === null ? null : Number(intervalParam);
  const selectedWindowStart = parsedInterval !== null && Number.isFinite(parsedInterval) ? parsedInterval : null;
  const { market, intervalState, now, currentWindowStart, displayedWindowStart } = useLivePredictionMarket(baseMarket, selectedWindowStart);
  const requestedOutcome = searchParams.get("outcome") ?? undefined;
  const defaultOutcome = getPredictionOutcome(baseMarket, requestedOutcome);
  const firstOutcomeId = baseMarket.outcomes[0].id;
  const [selectedOutcomeId, setSelectedOutcomeId] = useState(defaultOutcome.id);
  const [positions, setPositions] = useState<MockPredictionPositions>(() => ({ [defaultOutcome.id]: 24.4 }));

  useEffect(() => {
    const nextOutcome = getPredictionOutcome(baseMarket, requestedOutcome);
    setSelectedOutcomeId(nextOutcome.id);
    document.title = `${baseMarket.shortTitle} | BitDx Prediction Markets`;
  }, [baseMarket, requestedOutcome]);

  useEffect(() => {
    setPositions({ [firstOutcomeId]: 24.4 });
  }, [baseMarket.id, displayedWindowStart, firstOutcomeId]);

  const closed = market.status !== "OPEN" || intervalState === "PAST" || now >= new Date(market.endTime).getTime();
  const tradeDisabledReason = closed ? "Market closed" : intervalState === "UPCOMING" ? "Market has not started" : undefined;
  const selectOutcome = (id: string) => {
    setSelectedOutcomeId(id);
    const next = new URLSearchParams(searchParams);
    next.set("outcome", id);
    setSearchParams(next, { replace: true });
  };
  const selectInterval = (startTime: number | null) => {
    const next = new URLSearchParams(searchParams);
    if (startTime === null) next.delete("interval");
    else next.set("interval", String(startTime));
    setSearchParams(next, { replace: true });
  };

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-7xl space-y-5 p-4 sm:p-6">
        <MarketHeader market={market} closed={closed} intervalState={baseMarket.marketType === "PRICE_DIRECTION" ? intervalState : undefined} />
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
          <div className="min-w-0 space-y-5">
            <MarketStats market={market} intervalState={baseMarket.marketType === "PRICE_DIRECTION" ? intervalState : undefined} />
            <MarketPriceChart market={market} live={intervalState === "LIVE"} />
            {baseMarket.marketType === "PRICE_DIRECTION" && <MarketIntervalSelector now={now} currentWindowStart={currentWindowStart} selectedWindowStart={displayedWindowStart} intervalMinutes={baseMarket.intervalMinutes ?? 5} onSelect={selectInterval} />}
          </div>
          <div className="xl:sticky xl:top-20"><TradeTicket market={market} selectedOutcomeId={selectedOutcomeId} onSelectOutcome={selectOutcome} positions={positions} onPositionsChange={setPositions} disabledReason={tradeDisabledReason} /></div>
        </div>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
          <div className="space-y-5"><PredictionOrderBook key={market.id} market={market} initialOutcomeId={selectedOutcomeId} /><MarketInformation market={market} /></div>
          <RelatedMarkets market={market} />
        </div>
      </main>
    </AppShell>
  );
}
