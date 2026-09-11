// Mock market data + simulated WebSocket-style updates
export type AssetClass = "crypto" | "forex" | "commodity" | "stocks";
export type MarketKind = "spot" | "perp" | "options";

export type Market = {
  symbol: string;
  base: string;
  quote: string;
  price: number;
  change24h: number;
  volume24h: number;
  category: MarketKind; // perp | spot | options
  asset: AssetClass;    // crypto | forex | commodity | stocks
  trending?: boolean;
  favorite?: boolean;
  funding?: number;
  openInterest?: number;
  // Executable markets are overwritten by the engine's market-summary feed.
  // Non-executable markets intentionally retain their existing display data.
  dataStatus?: "live" | "unavailable" | "stale";
  updatedAt?: number;
};

// Every crypto market below has a REAL live price backing it via the hosted
// price-fetcher (https://price-fetcher-api.onrender.com/healthz), except
// BI2X (its own dedicated data feed, not Price-Fetcher's Binance client —
// see Price-Fetcher's config.go and backendMarkets.ts's comment on it).
// `price` below is only the pre-live-data seed useMarkets() starts from —
// see useLivePrice.ts, which prefers the real feed the instant it resolves.
//
// 2026-09-12 market-list restructure: SPOT is BI2X + BTC only; FUTURES is
// BI2X, BTC, ETH, AVAX, LINK, SOL, DOGE, TAO, ADA, XRP. BNB (previously
// SPOT+FUTURES) was REMOVED entirely, not disabled — no BNB row exists here
// any more. ETH and SOL keep their FUTURES rows but lost their SPOT ones;
// AVAX/LINK/DOGE/TAO/ADA/XRP are new FUTURES-only listings (all real
// Binance <ASSET>USDT tickers, verified live).
//
// The forex/commodity/stocks entries below are DISABLED as of 2026-09-11
// (product decision: crypto-only for the current launch) — Price-Fetcher's
// DefaultInstruments is now empty, so EURUSD/GBPUSD/AUDUSD, GOLD/SILVER/
// CrudeOIL, and AAPL.us/TSLA.us/NVDA.us no longer have a real price behind
// them at all. Left here (not deleted) purely as static seed data — every UI
// surface that would otherwise show them (MarketList.tsx, Markets.tsx) gates
// those asset classes behind a "Coming Soon" placeholder instead of
// rendering these rows. See matching-engine/cmd/engine/markets.go's
// disabledMarkets for the full list of what would need to come back
// together for these to be real again.
export const INITIAL_MARKETS: Market[] = [
  // --- SPOT: BI2X and BTC only ---
  // BTC-BIUSDB is the real, backend-connected spot market (see
  // backendMarkets.ts); BIUSDB is the platform's internal stable quote
  // currency, pegged 1:1 to USDT.
  { symbol: "BTC-BIUSDB", base: "BTC", quote: "BIUSDB", price: 67428.1, change24h: 2.31, volume24h: 980_000_000, category: "spot", asset: "crypto", favorite: true },
  // BI2X: a real engine spot market, but its base is NOT a Binance ticker —
  // priced from its own dedicated data feed instead. price/change24h/
  // volume24h here are placeholder seed values only, same role every row in
  // this list plays until useMarketIndexes.ts replaces them with the real
  // feed.
  { symbol: "BI2X-BIUSDB", base: "BI2X", quote: "BIUSDB", price: 100, change24h: 0, volume24h: 0, category: "spot", asset: "crypto" },

  // --- FUTURES: BI2X, BTC, ETH, AVAX, LINK, SOL, DOGE, TAO, ADA, XRP ---
  // Perps map to the matching engine's real *-BIUSDB futures markets —
  // collateralized/settled in BIUSDB, not USDC. ETH/AVAX/LINK/SOL/DOGE/TAO/
  // ADA/XRP are FUTURES-ONLY (no SPOT row above for any of them) but still
  // real, live-priced markets off Price-Fetcher's Binance feed.
  { symbol: "BTC-PERP", base: "BTC", quote: "BIUSDB", price: 67432.5, change24h: 2.34, volume24h: 1_240_000_000, category: "perp", asset: "crypto", trending: true, favorite: true, funding: 0.012, openInterest: 820_000_000 },
  { symbol: "BI2X-PERP", base: "BI2X", quote: "BIUSDB", price: 100, change24h: 0, volume24h: 0, category: "perp", asset: "crypto", funding: 0 },
  { symbol: "ETH-PERP", base: "ETH", quote: "BIUSDB", price: 3521.8, change24h: 1.87, volume24h: 720_000_000, category: "perp", asset: "crypto", trending: true, favorite: true, funding: 0.008, openInterest: 540_000_000 },
  { symbol: "AVAX-PERP", base: "AVAX", quote: "BIUSDB", price: 24.15, change24h: 1.02, volume24h: 180_000_000, category: "perp", asset: "crypto", funding: 0.0004 },
  { symbol: "LINK-PERP", base: "LINK", quote: "BIUSDB", price: 14.32, change24h: 0.68, volume24h: 210_000_000, category: "perp", asset: "crypto", funding: 0.0003 },
  { symbol: "SOL-PERP", base: "SOL", quote: "BIUSDB", price: 168.42, change24h: -3.12, volume24h: 410_000_000, category: "perp", asset: "crypto", trending: true, funding: -0.005, openInterest: 290_000_000 },
  { symbol: "DOGE-PERP", base: "DOGE", quote: "BIUSDB", price: 0.1285, change24h: 2.41, volume24h: 380_000_000, category: "perp", asset: "crypto", funding: 0.0006 },
  { symbol: "TAO-PERP", base: "TAO", quote: "BIUSDB", price: 412.7, change24h: -1.15, volume24h: 45_000_000, category: "perp", asset: "crypto", funding: 0.0002 },
  { symbol: "ADA-PERP", base: "ADA", quote: "BIUSDB", price: 0.4212, change24h: 0.85, volume24h: 150_000_000, category: "perp", asset: "crypto", funding: 0.0003 },
  { symbol: "XRP-PERP", base: "XRP", quote: "BIUSDB", price: 0.5891, change24h: -0.42, volume24h: 320_000_000, category: "perp", asset: "crypto", funding: 0.0002 },
  // Crypto options — BTC is the only backend-configured options underlying.
  { symbol: "BTC-OPT", base: "BTC", quote: "USD", price: 67432.5, change24h: 2.34, volume24h: 120_000_000, category: "options", asset: "crypto" },
  // Forex (futures only) — real engine markets (BASE-BIUSDB/FUTURES); base is
  // the Price-Fetcher's Live-Rates.com ticker.
  { symbol: "EURUSD", base: "EURUSD", quote: "BIUSDB", price: 1.0842, change24h: 0.21, volume24h: 5_400_000_000, category: "perp", asset: "forex", funding: 0.0001 },
  { symbol: "GBPUSD", base: "GBPUSD", quote: "BIUSDB", price: 1.2654, change24h: -0.14, volume24h: 3_100_000_000, category: "perp", asset: "forex", funding: 0.0002 },
  { symbol: "AUDUSD", base: "AUDUSD", quote: "BIUSDB", price: 0.6612, change24h: -0.32, volume24h: 1_800_000_000, category: "perp", asset: "forex", funding: 0.00015 },
  // Commodities (futures only) — real engine markets (GOLD/SILVER/CrudeOIL
  // -BIUSDB/FUTURES); base is the Price-Fetcher ticker, case-sensitive.
  { symbol: "XAU-USD", base: "GOLD", quote: "BIUSDB", price: 2384.5, change24h: 0.82, volume24h: 980_000_000, category: "perp", asset: "commodity", funding: 0.0008 },
  { symbol: "XAG-USD", base: "SILVER", quote: "BIUSDB", price: 28.42, change24h: 1.24, volume24h: 220_000_000, category: "perp", asset: "commodity", funding: 0.001 },
  { symbol: "WTI-USD", base: "CrudeOIL", quote: "BIUSDB", price: 78.32, change24h: -1.42, volume24h: 540_000_000, category: "perp", asset: "commodity", funding: 0.002 },
  // Stocks — futures + options only, no spot (matches forex/commodity,
  // which are also futures-only above). base carries Live-Rates.com's exact
  // case-sensitive ticker ("AAPL.us", not "AAPL") since that's the real
  // Redis key price-fetcher writes; see useIndexPrice.ts, which looks these
  // up verbatim. The perps are real engine markets (AAPL.us-BIUSDB/FUTURES...).
  { symbol: "AAPL-PERP", base: "AAPL.us", quote: "BIUSDB", price: 215.42, change24h: 1.42, volume24h: 8_400_000_000, category: "perp", asset: "stocks", favorite: true, funding: 0.0003 },
  { symbol: "TSLA-PERP", base: "TSLA.us", quote: "BIUSDB", price: 248.21, change24h: -2.12, volume24h: 6_200_000_000, category: "perp", asset: "stocks", trending: true, funding: 0.0004 },
  { symbol: "NVDA-PERP", base: "NVDA.us", quote: "BIUSDB", price: 124.84, change24h: 3.42, volume24h: 12_400_000_000, category: "perp", asset: "stocks", trending: true, funding: 0.0005 },
  { symbol: "AAPL-OPT", base: "AAPL.us", quote: "USD", price: 215.42, change24h: 1.42, volume24h: 320_000_000, category: "options", asset: "stocks" },
  { symbol: "TSLA-OPT", base: "TSLA.us", quote: "USD", price: 248.21, change24h: -2.12, volume24h: 260_000_000, category: "options", asset: "stocks" },
  { symbol: "NVDA-OPT", base: "NVDA.us", quote: "USD", price: 124.84, change24h: 3.42, volume24h: 410_000_000, category: "options", asset: "stocks" },
];

export function tickPrice(price: number, volatility = 0.0008): number {
  const change = (Math.random() - 0.5) * 2 * volatility;
  return Math.max(price * (1 + change), 0.000001);
}

export function formatPrice(p: number): string {
  if (p >= 1000) return p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (p >= 1) return p.toFixed(3);
  if (p >= 0.01) return p.toFixed(4);
  return p.toFixed(8);
}

export function formatCompact(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(2) + "K";
  return n.toFixed(2);
}

// OrderBookLevel / Trade: shape definitions shared with useOrderBook.ts's
// REAL live data (order-book depth and trade prints from the matching
// engine's WS/REST feeds). generateOrderBook/generateTrade — the functions
// that used to fabricate fake rows in these shapes for symbols with no
// backend market — have been removed; a symbol with no real market now
// shows a "not available" message instead (see RightColumn in Index.tsx),
// not synthetic data pretending to be depth.
export type OrderBookLevel = { price: number; size: number; total: number };

export type Trade = { id: string; price: number; size: number; side: "buy" | "sell"; time: number };

// Candle data for chart
export function generateCandles(basePrice: number, count = 80): { t: number; o: number; h: number; l: number; c: number; v: number }[] {
  const candles = [];
  let price = basePrice * 0.95;
  const now = Date.now();
  for (let i = count; i > 0; i--) {
    const o = price;
    const change = (Math.random() - 0.48) * basePrice * 0.008;
    const c = o + change;
    const h = Math.max(o, c) + Math.random() * basePrice * 0.004;
    const l = Math.min(o, c) - Math.random() * basePrice * 0.004;
    const v = Math.random() * 100 + 20;
    candles.push({ t: now - i * 60_000, o, h, l, c, v });
    price = c;
  }
  return candles;
}
