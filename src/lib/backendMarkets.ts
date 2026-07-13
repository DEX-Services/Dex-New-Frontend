// Maps frontend market symbols to backend-registered symbol+market pairs.
// Only pairs actually running in the matching engine get live data; everything
// else keeps the existing mock simulation.
const REGISTERED: Record<string, { symbol: string; market: string }> = {
  "BTC-USDT": { symbol: "BTC-USDT", market: "SPOT" },
  "ETH-USDT": { symbol: "ETH-USDT", market: "SPOT" },
  "BTC-PERP": { symbol: "BTC-USDC", market: "FUTURES" },
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
