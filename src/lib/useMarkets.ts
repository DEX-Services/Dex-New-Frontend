import { useEffect, useState } from "react";
import { INITIAL_MARKETS, Market, tickPrice } from "./mockData";
import { backendMarketFor, frontendSymbolFor } from "./backendMarkets";
import { getMarketSummary } from "./apiClient";
import { wsClient, WSEvent } from "./wsClient";

// Singleton-style hook. Live prices for executable markets are driven by the
// engine's WS TRADE stream (see wsUnsub below) — the same connection already
// open for order/fill events, at zero extra request cost per symbol, updated
// the instant a trade prints instead of up to SUMMARY_BASE_MS late. REST
// /market-summary polling below is now a slow-interval fallback/backfill
// only: it supplies 24h change/volume (a trade event can't derive that) and
// keeps a currently-quiet symbol (no recent trades) from showing stale
// forever. This mirrors real venues' top-bar/watchlist tickers, which show
// many symbols at once but via a streamed last-trade price, not a REST poll
// per symbol.
let listeners: Set<(m: Market[]) => void> = new Set();
let markets: Market[] = INITIAL_MARKETS.map(m => ({ ...m }));
let simulationInterval: ReturnType<typeof setInterval> | null = null;
let summaryTimer: ReturnType<typeof setTimeout> | null = null;
// Backfill only now that trades drive live price — far less urgent than
// when this was the sole price source, hence the much longer base interval.
const SUMMARY_BASE_MS = 30000;
const SUMMARY_MAX_MS = 120000;
let summaryDelay = SUMMARY_BASE_MS;
let wsUnsub: (() => void) | null = null;

function publish() {
  listeners.forEach(l => l(markets));
}

function setExecutableMarketsUnavailable() {
  markets = markets.map(m => backendMarketFor(m.symbol)
    ? { ...m, price: 0, change24h: 0, volume24h: 0, dataStatus: "unavailable" as const, updatedAt: undefined }
    : m
  );
}

async function refreshExecutableMarkets(): Promise<boolean> {
  const executable = markets.filter(m => backendMarketFor(m.symbol));
  const results = await Promise.all(executable.map(async (market) => {
    const backend = backendMarketFor(market.symbol)!;
    try {
      const summary = await getMarketSummary(backend.symbol, backend.market);
      const price = Number(summary.price);
      const updatedAt = Date.parse(summary.updatedAt);
      if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(updatedAt)) {
        throw new Error("market summary is unavailable");
      }
      markets = markets.map(m => m.symbol !== market.symbol ? m : {
        ...m,
        price,
        change24h: summary.has24hData ? Number(summary.change24hPct ?? 0) : 0,
        volume24h: summary.has24hData ? Number(summary.volume24h ?? 0) : 0,
        dataStatus: "live" as const,
        updatedAt,
      });
      return true;
    } catch {
      markets = markets.map(m => {
        if (m.symbol !== market.symbol) return m;
        // Retain the last genuine engine value but clearly mark it stale;
        // never replace it with a simulated or external value.
        if (m.dataStatus === "live") return { ...m, dataStatus: "stale" as const };
        return { ...m, dataStatus: "unavailable" as const };
      });
      return false;
    }
  }));
  publish();
  return results.some(Boolean);
}

// applyTradeEvent updates one market's live price from a WS TRADE event.
// Only touches price/dataStatus/updatedAt — change24h/volume24h stay
// whatever the last REST summary said until the next backfill poll, since a
// single trade can't derive a 24h window on its own.
function applyTradeEvent(evt: WSEvent) {
  if (evt.type !== "TRADE" || !evt.trade) return;
  const frontendSymbol = frontendSymbolFor(evt.trade.symbol, evt.trade.market);
  const price = Number(evt.trade.price);
  if (!Number.isFinite(price) || price <= 0) return;
  const updatedAt = Date.parse(evt.trade.executedAt);
  let touched = false;
  markets = markets.map(m => {
    if (m.symbol !== frontendSymbol || !backendMarketFor(m.symbol)) return m;
    touched = true;
    return {
      ...m,
      price,
      dataStatus: "live" as const,
      updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
    };
  });
  if (touched) publish();
}

function start() {
  if (simulationInterval) return;
  setExecutableMarketsUnavailable();
  wsUnsub = wsClient.subscribe(applyTradeEvent);
  // Preserve the existing simulated display behavior only for assets that are
  // not yet part of the current five-market execution rollout.
  simulationInterval = setInterval(() => {
    markets = markets.map(m => {
      if (backendMarketFor(m.symbol)) return m;
      const newPrice = tickPrice(m.price, m.category === "perp" ? 0.0012 : 0.0008);
      const change = m.change24h + (newPrice - m.price) / m.price * 100;
      return { ...m, price: newPrice, change24h: change };
    });
    publish();
  }, 1500);
  const runSummary = () => {
    void refreshExecutableMarkets().then((anyOk) => {
      // Back off together on a shared delay when every symbol fails (e.g. the
      // backend is down), so a persistent outage doesn't keep hitting it
      // every 15s for as many symbols as are executable, forever.
      summaryDelay = anyOk ? SUMMARY_BASE_MS : Math.min(summaryDelay * 2, SUMMARY_MAX_MS);
      summaryTimer = setTimeout(runSummary, summaryDelay);
    });
  };
  runSummary();
}

export function useMarkets() {
  const [data, setData] = useState<Market[]>(markets);
  useEffect(() => {
    start();
    listeners.add(setData);
    return () => { listeners.delete(setData); };
  }, []);
  return data;
}

export function useMarket(symbol: string) {
  const all = useMarkets();
  return all.find(m => m.symbol === symbol);
}
