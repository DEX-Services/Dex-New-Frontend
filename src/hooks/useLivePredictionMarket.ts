import { useEffect, useMemo, useState } from "react";
import type { PredictionMarket } from "@/lib/predictionMarkets";
import {
  createLivePredictionMarketSnapshot,
  getDirectionIntervalStart,
  type PredictionIntervalState,
} from "@/lib/predictionSimulation";

export function useLivePredictionMarket(baseMarket: PredictionMarket, selectedWindowStart: number | null) {
  const [now, setNow] = useState(Date.now);
  const intervalMs = (baseMarket.intervalMinutes ?? 5) * 60_000;

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [baseMarket.id]);

  const currentWindowStart = getDirectionIntervalStart(now, intervalMs);
  const displayedWindowStart = selectedWindowStart ?? currentWindowStart;
  const snapshot = useMemo(
    () => createLivePredictionMarketSnapshot(baseMarket, displayedWindowStart, now, intervalMs),
    [baseMarket, displayedWindowStart, intervalMs, now],
  );

  return {
    market: snapshot.market,
    intervalState: snapshot.intervalState as PredictionIntervalState,
    now,
    currentWindowStart,
    displayedWindowStart,
    intervalMs,
  };
}
