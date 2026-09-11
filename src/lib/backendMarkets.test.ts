import { describe, it, expect } from "vitest";
import { backendMarketFor, backendOptionsMarketFor, frontendSymbolFor, registeredFuturesSymbols } from "./backendMarkets";

describe("backendMarketFor", () => {
  it("resolves all currently-registered symbols", () => {
    expect(backendMarketFor("BTC-BIUSD")).toEqual({ symbol: "BTC-BIUSD", market: "SPOT" });
    expect(backendMarketFor("ETH-BIUSD")).toEqual({ symbol: "ETH-BIUSD", market: "SPOT" });
    expect(backendMarketFor("SOL-BIUSD")).toEqual({ symbol: "SOL-BIUSD", market: "SPOT" });
    expect(backendMarketFor("BNB-BIUSD")).toEqual({ symbol: "BNB-BIUSD", market: "SPOT" });
    // Futures collateralize/settle in BIUSD too — a distinct (symbol, market)
    // row from the SPOT entry of the same engine symbol name.
    expect(backendMarketFor("BTC-PERP")).toEqual({ symbol: "BTC-BIUSD", market: "FUTURES" });
    expect(backendMarketFor("ETH-PERP")).toEqual({ symbol: "ETH-BIUSD", market: "FUTURES" });
  });

  it("returns null for a symbol with no backend market", () => {
    // This is the exact case that used to trigger a fake "order placed"
    // success toast in TradePanel.tsx — asserting it stays null pins the
    // contract the honest-error fix depends on.
    expect(backendMarketFor("DOGE-PERP")).toBeNull();
    expect(backendMarketFor("USDT-BIUSD")).toBeNull();
  });

  it("returns null for non-crypto perps (disabled 2026-09-11 — crypto-only launch)", () => {
    // FX/commodities/stocks are commented out of REGISTERED, not deleted —
    // see that map's own comment for how to bring one back. Pinning null
    // here (rather than just removing these cases) means a future
    // uncomment-without-testing mistake shows up as a failing "still
    // disabled" assertion instead of silently doing nothing.
    expect(backendMarketFor("EURUSD")).toBeNull();
    expect(backendMarketFor("XAU-USD")).toBeNull();
    expect(backendMarketFor("WTI-USD")).toBeNull();
    expect(backendMarketFor("AAPL-PERP")).toBeNull();
  });
});

describe("registeredFuturesSymbols", () => {
  it("returns only FUTURES entries, in engine-symbol form", () => {
    const futures = registeredFuturesSymbols();
    expect(futures).toContainEqual({ symbol: "BTC-BIUSD", market: "FUTURES" });
    expect(futures).toContainEqual({ symbol: "ETH-BIUSD", market: "FUTURES" });
    // No SPOT entries should leak in.
    expect(futures.every((f) => f.market === "FUTURES")).toBe(true);
  });

  it("is crypto-only while forex/commodities/stocks stay disabled", () => {
    // 4 crypto perps (BTC, ETH, SOL, BNB) — the 9 non-crypto rows are
    // commented out of REGISTERED, see backendMarkets.ts.
    expect(registeredFuturesSymbols()).toHaveLength(4);
  });
});

describe("frontendSymbolFor", () => {
  it("is the inverse of backendMarketFor for registered symbols", () => {
    expect(frontendSymbolFor("BTC-BIUSD", "FUTURES")).toBe("BTC-PERP");
    expect(frontendSymbolFor("ETH-BIUSD", "FUTURES")).toBe("ETH-PERP");
    expect(frontendSymbolFor("SOL-BIUSD", "SPOT")).toBe("SOL-BIUSD");
  });

  it("falls back to the engine symbol itself when unregistered", () => {
    expect(frontendSymbolFor("DOGE-BIUSD", "SPOT")).toBe("DOGE-BIUSD");
    // GOLD/AAPL.us are disabled (commented out of REGISTERED) — falls back
    // to the raw engine symbol, same as any other unregistered pair.
    expect(frontendSymbolFor("GOLD-BIUSD", "FUTURES")).toBe("GOLD-BIUSD");
    expect(frontendSymbolFor("AAPL.us-BIUSD", "FUTURES")).toBe("AAPL.us-BIUSD");
  });
});

describe("backendOptionsMarketFor", () => {
  it("resolves the configured underlying for BTC", () => {
    expect(backendOptionsMarketFor("BTC")).toEqual({ symbol: "BTC-BIUSD", market: "OPTIONS" });
  });

  it("returns null for an asset with no options underlying configured", () => {
    expect(backendOptionsMarketFor("ETH")).toBeNull();
  });
});
