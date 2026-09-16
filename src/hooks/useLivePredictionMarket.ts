import { useEffect, useRef, useState } from "react";
import { getPredictionWindows, type PredictionTick, type PredictionWindow } from "@/lib/predictionApi";
import { predictionWsClient } from "@/lib/predictionWsClient";
import { predictionMarketId, type PredictionMarket, type PredictionOutcome, type PredictionPricePoint } from "@/lib/predictionMarkets";

const ICON: Record<string, string> = { BTC: "BTC", ETH: "ETH", SOL: "SOL" };
const MAX_HISTORY_POINTS = 120;

function windowToMarket(win: PredictionWindow, yesPrice?: number, currentPrice?: number): PredictionMarket {
  const yes = yesPrice ?? 0.5;
  const outcomes: PredictionOutcome[] = [
    { id: "yes", label: "YES", price: Number(yes.toFixed(2)), tone: "positive" },
    { id: "no", label: "NO", price: Number((1 - yes).toFixed(2)), tone: "negative" },
  ];
  const status = win.status === "settled" ? "RESOLVED" : win.status === "locked" ? "CLOSED" : "OPEN";
  return {
    id: predictionMarketId(win.market, win.duration === "5m" ? 5 : 15),
    windowId: win.id,
    slug: predictionMarketId(win.market, win.duration === "5m" ? 5 : 15),
    title: `${win.market} Above Target — Next ${win.duration === "5m" ? "5 Minutes" : "15 Minutes"}`,
    shortTitle: `${win.market} Above Target`,
    icon: ICON[win.market] ?? win.market,
    symbol: win.market,
    interval: win.duration === "5m" ? "5 Minutes" : "15 Minutes",
    intervalMinutes: win.duration === "5m" ? 5 : 15,
    status,
    startTime: win.startTime,
    endTime: win.endTime,
    referencePrice: win.targetPrice ? Number(win.targetPrice) : undefined,
    currentPrice: currentPrice ?? (win.openingPrice ? Number(win.openingPrice) : undefined),
    priceHistory: [],
    outcomes,
    orderBooks: [
      { outcomeId: "yes", bids: [], asks: [], lastPrice: outcomes[0].price },
      { outcomeId: "no", bids: [], asks: [], lastPrice: outcomes[1].price },
    ],
    relatedMarketIds: [],
  };
}

/**
 * Loads the current round for a symbol/duration from the REST API, then
 * keeps it live via the prediction-service's WebSocket tick stream (one
 * broadcast per second per round). Falls back to polling REST every 5s if
 * the socket hasn't delivered a tick recently, so the UI never fully stalls
 * on a dropped connection.
 */
export function useLivePredictionMarket(symbol: "BTC" | "ETH" | "SOL", intervalMinutes: 5 | 15) {
  const duration = intervalMinutes === 5 ? "5m" : "15m";
  const [market, setMarket] = useState<PredictionMarket | null>(null);
  const [now, setNow] = useState(Date.now);
  const historyRef = useRef<PredictionPricePoint[]>([]);
  const windowIdRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    historyRef.current = [];
    windowIdRef.current = null;

    const loadOnce = async () => {
      try {
        const windows = await getPredictionWindows();
        if (cancelled) return;
        const win = windows.find((w) => w.market === symbol && w.duration === duration);
        if (win) {
          windowIdRef.current = win.id;
          setMarket(windowToMarket(win));
        }
      } catch {
        /* transient network error; next poll or tick will recover */
      }
    };
    loadOnce();
    const pollTimer = window.setInterval(loadOnce, 5000);

    const unsubscribeTick = predictionWsClient.subscribe((tick: PredictionTick) => {
      if (tick.market !== symbol || tick.duration !== duration) return;
      windowIdRef.current = tick.windowId;
      const currentPrice = Number(tick.currentPrice);
      const timestamp = new Date().toISOString();
      historyRef.current = [...historyRef.current, { timestamp, price: currentPrice }].slice(-MAX_HISTORY_POINTS);
      const yesPrice = Number(tick.yesPrice);
      setMarket((prev) => {
        const base: PredictionMarket = prev && prev.windowId === tick.windowId
          ? prev
          : {
              id: predictionMarketId(symbol, intervalMinutes),
              windowId: tick.windowId,
              slug: predictionMarketId(symbol, intervalMinutes),
              title: `${symbol} Above Target — Next ${intervalMinutes === 5 ? "5 Minutes" : "15 Minutes"}`,
              shortTitle: `${symbol} Above Target`,
              icon: ICON[symbol] ?? symbol,
              symbol,
              interval: intervalMinutes === 5 ? "5 Minutes" : "15 Minutes",
              intervalMinutes,
              status: "OPEN",
              startTime: new Date().toISOString(),
              endTime: new Date(Date.now() + tick.timeRemaining).toISOString(),
              priceHistory: [],
              outcomes: [],
              orderBooks: [],
              relatedMarketIds: [],
            };
        return {
          ...base,
          windowId: tick.windowId,
          status: tick.status === "settled" ? "RESOLVED" : tick.status === "locked" ? "CLOSED" : "OPEN",
          endTime: new Date(Date.now() + tick.timeRemaining).toISOString(),
          referencePrice: Number(tick.targetPrice),
          currentPrice,
          priceHistory: historyRef.current,
          outcomes: [
            { id: "yes", label: "YES", price: Number(yesPrice.toFixed(2)), tone: "positive" },
            { id: "no", label: "NO", price: Number((1 - yesPrice).toFixed(2)), tone: "negative" },
          ],
          orderBooks: base.orderBooks.length
            ? base.orderBooks
            : [
                { outcomeId: "yes", bids: [], asks: [], lastPrice: yesPrice },
                { outcomeId: "no", bids: [], asks: [], lastPrice: 1 - yesPrice },
              ],
        };
      });
    });

    const clockTimer = window.setInterval(() => setNow(Date.now()), 1000);

    return () => {
      cancelled = true;
      window.clearInterval(pollTimer);
      window.clearInterval(clockTimer);
      unsubscribeTick();
    };
  }, [symbol, duration, intervalMinutes]);

  const closed = market ? market.status !== "OPEN" || now >= new Date(market.endTime).getTime() : false;

  return { market, now, closed, windowId: windowIdRef.current };
}
