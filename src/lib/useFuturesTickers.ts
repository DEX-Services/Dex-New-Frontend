import { useEffect, useRef, useState } from "react";
import { getTicker } from "./apiClient";
import { registeredFuturesSymbols } from "./backendMarkets";
import type { Ticker } from "./useTicker";
import { wsClient, WSEvent } from "./wsClient";

// Batch version of useTicker for every backend-registered FUTURES symbol at
// once — used by PositionsPanel, which needs a mark price + MMR per
// position and can't know ahead of time how many distinct futures symbols
// a user's open positions span. Keyed by engine symbol (e.g. "BTC-USDC").
//
// This replaces a hardcoded MAINTENANCE_MARGIN_RATE map in backendMarkets.ts
// that was the only source for the liquidation-price preview and could
// silently drift from the real symbol_configs value.
//
// Live price updates (mid/mark) are driven by the engine's WS TRADE stream,
// same as useMarkets — the instant a trade prints, not up to BASE_POLL_MS
// late, and at zero extra request cost per symbol. REST polling below is now
// a slow backfill for the fields a trade event can't supply (funding rate,
// MMR, bid/ask spread, index price) and for symbols with no recent trades.

const BASE_POLL_MS = 15000;
const MAX_POLL_MS = 120000;

function toTicker(res: Awaited<ReturnType<typeof getTicker>>): Ticker {
  const num = (s: string | undefined) => {
    if (!s) return null;
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
  };
  return {
    bestBid: num(res.bestBid) ?? 0,
    bestAsk: num(res.bestAsk) ?? 0,
    midPrice: num(res.midPrice) ?? 0,
    markPrice: num(res.markPrice) ?? 0,
    indexPrice: num(res.indexPrice),
    spread: num(res.spread) ?? 0,
    fundingRatePct: num(res.fundingRatePct),
    makerFeePct: num(res.makerFeePct),
    takerFeePct: num(res.takerFeePct),
    maintenanceMarginRatePct: num(res.maintenanceMarginRatePct),
  };
}

/**
 * Live tickers for every registered futures symbol, keyed by engine symbol
 * (e.g. { "BTC-USDC": Ticker, "ETH-USDC": Ticker }). A symbol only appears
 * once its first successful fetch resolves; until then (or on persistent
 * error) it's simply absent from the map — callers should treat a missing
 * key as "no real data," not "zero."
 */
export function useFuturesTickers(): Record<string, Ticker> {
  const [tickers, setTickers] = useState<Record<string, Ticker>>({});
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const symbols = registeredFuturesSymbols();
    if (symbols.length === 0) return;

    let cancelled = false;
    // Backing off together (one shared delay, not per-symbol) keeps this
    // batch poller's failure behavior simple: any failure this round pushes
    // the whole next round out, so a downed backend doesn't get hit by 13
    // symbols' worth of requests every tick indefinitely.
    let delay = BASE_POLL_MS;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const pollOne = async ({ symbol, market }: { symbol: string; market: string }) => {
      try {
        const res = await getTicker(symbol, market);
        if (cancelled) return;
        setTickers((prev) => ({ ...prev, [symbol]: toTicker(res) }));
        return true;
      } catch {
        // Symbol not registered or transient network error: leave whatever
        // was last known (if anything) in place, retry next tick.
        return false;
      }
    };

    const scheduleNext = () => {
      if (cancelled) return;
      timer = setTimeout(pollAll, delay);
    };

    const pollAll = async () => {
      const results = await Promise.all(symbols.map((s) => pollOne(s)));
      if (cancelled) return;
      const anyOk = results.some(Boolean);
      delay = anyOk ? BASE_POLL_MS : Math.min(delay * 2, MAX_POLL_MS);
      scheduleNext();
    };

    void pollAll();

    // symbols is keyed by engine symbol (e.g. "BTC-USDC"), which is exactly
    // what WSTrade.symbol carries — no frontend<->engine symbol translation
    // needed here, unlike useMarkets (which is keyed by the display symbol).
    const tracked = new Set(symbols.map((s) => s.symbol));
    const unsubWs = wsClient.subscribe((evt: WSEvent) => {
      if (evt.type !== "TRADE" || !evt.trade || !tracked.has(evt.trade.symbol)) return;
      const price = Number(evt.trade.price);
      if (!Number.isFinite(price) || price <= 0) return;
      if (cancelled) return;
      setTickers((prev) => {
        const existing = prev[evt.trade!.symbol];
        // Don't fabricate a whole Ticker from a bare trade print before the
        // first REST poll has ever resolved — wait for that to seed the
        // other fields (funding rate, MMR, spread) at least once.
        if (!existing) return prev;
        return { ...prev, [evt.trade!.symbol]: { ...existing, midPrice: price, markPrice: price } };
      });
    });

    return () => {
      cancelled = true;
      mountedRef.current = false;
      if (timer) clearTimeout(timer);
      unsubWs();
    };
  }, []);

  return tickers;
}
