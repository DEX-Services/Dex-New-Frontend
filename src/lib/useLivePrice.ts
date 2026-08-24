import { useMarket } from "./useMarkets";
import { useIndexPrice } from "./useIndexPrice";

// The single "what price is this symbol at right now" answer for the trade
// page — real index price (Redis-backed, ultimately from Binance/Live-Rates
// via price-fetcher) when the asset is crypto and the feed is live, the
// client-side mock simulator otherwise.
//
// This priority order previously lived only inside MarketHeader.tsx, so the
// header showed the real price while everything else on the page (order
// entry default price, TP/SL target seeds, liquidation preview, the chart,
// the option chain, position sizing) kept reading straight from the mock
// simulator — e.g. header at $79,602 while the order panel defaulted to a
// stale $67,432.50 baked into mockData.ts. Anything that needs "the current
// price for this symbol" should use this hook instead of useMarket(...).price
// directly, so there's exactly one place this priority order is decided.
export function useLivePrice(symbol: string): number {
  const market = useMarket(symbol);
  const index = useIndexPrice(market?.asset === "crypto" ? market.base : undefined);
  return index?.lastPrice ?? market?.price ?? 0;
}
