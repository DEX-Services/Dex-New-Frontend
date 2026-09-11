// Maps frontend market symbols to backend-registered symbol+market pairs.
// Only pairs actually running in the matching engine get live data; everything
// else keeps the existing mock simulation.
//
// Every pair — spot and futures — quotes in BIUSDB, the platform's internal
// stable currency (pegged 1:1 to USDT, no on-chain contract of its own) —
// see Dex-Backend's chain.Listener and the matching-engine's
// cmd/engine/markets.go. USDT/USDC are no longer tradable quote currencies;
// futures collateral used to be real USDC, now converts to/settles in BIUSDB
// like everything else. The engine symbol for a PERP is "BASE-BIUSDB" too —
// distinct from the SPOT row of the same name via the (symbol, market) key.
const REGISTERED: Record<string, { symbol: string; market: string }> = {
  "BTC-BIUSDB": { symbol: "BTC-BIUSDB", market: "SPOT" },
  "ETH-BIUSDB": { symbol: "ETH-BIUSDB", market: "SPOT" },
  "SOL-BIUSDB": { symbol: "SOL-BIUSDB", market: "SPOT" },
  "BNB-BIUSDB": { symbol: "BNB-BIUSDB", market: "SPOT" },
  "BTC-PERP": { symbol: "BTC-BIUSDB", market: "FUTURES" },
  "ETH-PERP": { symbol: "ETH-BIUSDB", market: "FUTURES" },
  // Crypto perps beyond BTC/ETH — the SOL/BNB spot books double as their
  // funding/index underlying.
  "SOL-PERP": { symbol: "SOL-BIUSDB", market: "FUTURES" },
  "BNB-PERP": { symbol: "BNB-BIUSDB", market: "FUTURES" },
  // BI2X: not a Binance-tracked asset like the crypto pairs above — its
  // index price is meant to come from a separate data-feed API (link
  // pending as of 2026-09-12, see Price-Fetcher's config.go). The engine
  // registration and order submission work today regardless; only the
  // market-maker's automated quoting is blocked until that feed lands, since
  // it correctly refuses to quote on a stale/missing index price.
  "BI2X-BIUSDB": { symbol: "BI2X-BIUSDB", market: "SPOT" },
  "BI2X-PERP": { symbol: "BI2X-BIUSDB", market: "FUTURES" },

  // Forex majors, commodities, and US stocks are DISABLED (2026-09-11 product
  // decision: crypto-only for the current launch) — matching-engine no
  // longer registers any of these (see cmd/engine/markets.go's
  // disabledMarkets), so leaving them "REGISTERED" here would make the trade
  // page believe a live order book exists where the engine has none. Not
  // deleted: uncomment together with matching-engine's disabledMarkets,
  // seed.go's commented rows, and Price-Fetcher's DefaultInstruments to
  // bring any of these back.
  //
  // Non-crypto perps. The engine symbol's base is the Price-Fetcher ticker,
  // case-preserved ("CrudeOIL", "AAPL.us"); there is no engine spot book for
  // any of these, so their futures rows carry no funding underlying.
  // EURUSD: { symbol: "EURUSD-BIUSDB", market: "FUTURES" },
  // GBPUSD: { symbol: "GBPUSD-BIUSDB", market: "FUTURES" },
  // AUDUSD: { symbol: "AUDUSD-BIUSDB", market: "FUTURES" },
  // "XAU-USD": { symbol: "GOLD-BIUSDB", market: "FUTURES" },
  // "XAG-USD": { symbol: "SILVER-BIUSDB", market: "FUTURES" },
  // "WTI-USD": { symbol: "CrudeOIL-BIUSDB", market: "FUTURES" },
  // "AAPL-PERP": { symbol: "AAPL.us-BIUSDB", market: "FUTURES" },
  // "TSLA-PERP": { symbol: "TSLA.us-BIUSDB", market: "FUTURES" },
  // "NVDA-PERP": { symbol: "NVDA.us-BIUSDB", market: "FUTURES" },
};

// Underlying spot pair registered as an Options market in the engine, keyed
// by the base asset shown in the trade panel (e.g. "BTC" from "BTC-BIUSDB").
// The backend's /option-chain endpoint is queried with this underlying symbol.
const OPTIONS_UNDERLYING: Record<string, { underlying: string; quote: string }> = {
  BTC: { underlying: "BTC-BIUSDB", quote: "BIUSDB" },
};

export function backendOptionsMarketFor(baseAsset: string) {
  const entry = OPTIONS_UNDERLYING[baseAsset];
  if (!entry) return null;
  return { symbol: entry.underlying, market: "OPTIONS" };
}

export function backendMarketFor(frontendSymbol: string) {
  return REGISTERED[frontendSymbol] ?? null;
}

// All backend-registered FUTURES symbol/market pairs, engine-symbol form
// (e.g. "BTC-USDC", not "BTC-PERP"). Used to batch-fetch real tickers
// (mark price, MMR) for every open position's symbol at once, instead of
// hardcoding maintenance margin rates client-side — that hardcoded map used
// to be the only source for the liquidation-price preview and could
// silently drift from whatever symbol_configs actually says.
export function registeredFuturesSymbols(): { symbol: string; market: string }[] {
  return Object.values(REGISTERED).filter((e) => e.market === "FUTURES");
}

// optionInstrumentSymbol builds the per-instrument symbol the backend now
// expects for option orders. Format: BASE-QUOTE-STRIKE-EXPIRY-TYPE
// (e.g. "BTC-BIUSDB-55000-20250102-CALL"), matching the backend's seed format.
//
// strike:  numeric strike price (e.g. 55000)
// expiry:  RFC3339 timestamp from the option chain (e.g. "2025-01-15T00:00:00Z")
// type:    "CALL" | "PUT"
// baseAsset: e.g. "BTC"
export function optionInstrumentSymbol(
  baseAsset: string,
  strike: number | string,
  expiry: string,
  type: "CALL" | "PUT"
): string {
  const entry = OPTIONS_UNDERLYING[baseAsset];
  const quote = entry?.quote ?? "BIUSDB";
  const expiryDate = expiry.slice(0, 10).replace(/-/g, "");
  return `${baseAsset}-${quote}-${strike}-${expiryDate}-${type}`;
}

// Reverse of backendMarketFor: given the raw engine symbol+market (as
// returned in position/order DTOs), find the frontend display symbol used
// as the key into useMarkets()'s live price feed.
export function frontendSymbolFor(engineSymbol: string, engineMarket: string) {
  for (const [frontendSymbol, entry] of Object.entries(REGISTERED)) {
    if (entry.symbol === engineSymbol && entry.market === engineMarket) {
      return frontendSymbol;
    }
  }
  return engineSymbol;
}
