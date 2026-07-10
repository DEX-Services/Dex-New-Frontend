// Maps frontend market symbols to backend-registered symbol+market pairs.
// Only pairs actually running in the matching engine get live data; everything
// else keeps the existing mock simulation.
const REGISTERED: Record<string, { symbol: string; market: string }> = {
  "BTC-USDT": { symbol: "BTC-USDT", market: "SPOT" },
  "ETH-USDT": { symbol: "ETH-USDT", market: "SPOT" },
  "BTC-PERP": { symbol: "BTC-USDT", market: "FUTURES" },
};

export function backendMarketFor(frontendSymbol: string) {
  return REGISTERED[frontendSymbol] ?? null;
}
