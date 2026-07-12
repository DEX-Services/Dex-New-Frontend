// Maps frontend market symbols to backend-registered symbol+market pairs.
// Only pairs actually running in the matching engine get live data; everything
// else keeps the existing mock simulation.
const REGISTERED: Record<string, { symbol: string; market: string }> = {
  "BTC-USDT": { symbol: "BTC-USDT", market: "SPOT" },
  "ETH-USDT": { symbol: "ETH-USDT", market: "SPOT" },
  "BTC-PERP": { symbol: "BTC-USDT", market: "FUTURES" },
};

// Underlying spot symbol registered as an Options market in the engine, keyed
// by the base asset shown in the trade panel (e.g. "BTC" from "BTC-USDT").
const OPTIONS_UNDERLYING: Record<string, { symbol: string; market: string }> = {
  BTC: { symbol: "BTC-USDT", market: "OPTIONS" },
};

export function backendOptionsMarketFor(baseAsset: string) {
  return OPTIONS_UNDERLYING[baseAsset] ?? null;
}

export function backendMarketFor(frontendSymbol: string) {
  return REGISTERED[frontendSymbol] ?? null;
}
