import { useEffect, useRef, useState } from "react";
import { getPredictionWindows, type PredictionTick, type PredictionWindow } from "@/lib/predictionApi";
import { predictionWsClient } from "@/lib/predictionWsClient";
import { predictionMarketId, type PredictionMarket, type PredictionPricePoint } from "@/lib/predictionMarkets";

const ICON: Record<string, string> = { BTC: "BTC", ETH: "ETH", SOL: "SOL" };
const MAX_HISTORY_POINTS = 120;

// REST gives us window identity/timing (id, start/end, status) — the things
// a 5s poll can safely own. Live price/outcome data comes exclusively from
// WebSocket ticks; REST must never touch those fields once ticks are
// flowing, or every poll would stomp the live chart/prices back to a bare
// 50/50 placeholder (this was the "chart disappears every few seconds" bug).
function windowToMarket(win: PredictionWindow): PredictionMarket {
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
    currentPrice: win.openingPrice ? Number(win.openingPrice) : undefined,
    priceHistory: [],
    outcomes: [
      { id: "yes", label: "YES", price: 0.5, tone: "positive" },
      { id: "no", label: "NO", price: 0.5, tone: "negative" },
    ],
    orderBooks: [],
    relatedMarketIds: [],
  };
}

/**
 * Loads the current round for a symbol/duration from the REST API, then
 * keeps it live via the prediction-service's WebSocket tick stream (one
 * broadcast per second per round). REST only ever supplies window identity
 * and timing/status — once a tick for the current window has arrived, REST
 * polls are merged in a way that never overwrites price/outcome data, so a
 * routine 5s poll can't undo what the live socket already rendered.
 */
export function useLivePredictionMarket(symbol: "BTC" | "ETH" | "SOL", intervalMinutes: 5 | 15) {
  const duration = intervalMinutes === 5 ? "5m" : "15m";
  const [market, setMarket] = useState<PredictionMarket | null>(null);
  const [now, setNow] = useState(Date.now);
  const historyRef = useRef<PredictionPricePoint[]>([]);
  const tickWindowIdRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    historyRef.current = [];
    tickWindowIdRef.current = null;

    const loadOnce = async () => {
      try {
        const windows = await getPredictionWindows();
        if (cancelled) return;
        const win = windows.find((w) => w.market === symbol && w.duration === duration);
        if (!win) return;

        setMarket((prev) => {
          // A tick for this exact window has already populated live price
          // data — only refresh the timing/status fields REST is
          // authoritative for, keep everything price-related as-is.
          if (prev && prev.windowId === win.id && tickWindowIdRef.current === win.id) {
            return {
              ...prev,
              status: win.status === "settled" ? "RESOLVED" : win.status === "locked" ? "CLOSED" : "OPEN",
              startTime: win.startTime,
              endTime: win.endTime,
            };
          }
          // New window (round rolled over) or no live data yet: safe to use
          // the full REST-derived placeholder until the next tick arrives.
          if (prev?.windowId !== win.id) {
            historyRef.current = [];
            tickWindowIdRef.current = null;
          }
          return windowToMarket(win);
        });
      } catch {
        /* transient network error; next poll or tick will recover */
      }
    };
    loadOnce();
    const pollTimer = window.setInterval(loadOnce, 5000);

    const unsubscribeTick = predictionWsClient.subscribe((tick: PredictionTick) => {
      if (tick.market !== symbol || tick.duration !== duration) return;
      if (tickWindowIdRef.current !== tick.windowId) {
        historyRef.current = [];
      }
      tickWindowIdRef.current = tick.windowId;
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

  return { market, now, closed, windowId: tickWindowIdRef.current };
}
