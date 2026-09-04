import { describe, it, expect } from "vitest";
import { backendMarketFor, backendOptionsMarketFor, frontendSymbolFor, registeredFuturesSymbols } from "./backendMarkets";

describe("backendMarketFor", () => {
  it("resolves all currently-registered symbols", () => {
    expect(backendMarketFor("BTC-USDB")).toEqual({ symbol: "BTC-USDB", market: "SPOT" });
    expect(backendMarketFor("ETH-USDB")).toEqual({ symbol: "ETH-USDB", market: "SPOT" });
    expect(backendMarketFor("SOL-USDB")).toEqual({ symbol: "SOL-USDB", market: "SPOT" });
    expect(backendMarketFor("BNB-USDB")).toEqual({ symbol: "BNB-USDB", market: "SPOT" });
    // Futures collateralize/settle in USDB too — a distinct (symbol, market)
    // row from the SPOT entry of the same engine symbol name.
    expect(backendMarketFor("BTC-PERP")).toEqual({ symbol: "BTC-USDB", market: "FUTURES" });
    expect(backendMarketFor("ETH-PERP")).toEqual({ symbol: "ETH-USDB", market: "FUTURES" });
  });

  it("returns null for a symbol with no backend market", () => {
    // This is the exact case that used to trigger a fake "order placed"
    // success toast in TradePanel.tsx — asserting it stays null pins the
    // contract the honest-error fix depends on.
    expect(backendMarketFor("EURUSD")).toBeNull();
    expect(backendMarketFor("AAPL-PERP")).toBeNull();
    expect(backendMarketFor("SOL-PERP")).toBeNull();
  });
});

describe("registeredFuturesSymbols", () => {
  it("returns only FUTURES entries, in engine-symbol form", () => {
    const futures = registeredFuturesSymbols();
    expect(futures).toContainEqual({ symbol: "BTC-USDB", market: "FUTURES" });
    expect(futures).toContainEqual({ symbol: "ETH-USDB", market: "FUTURES" });
    // No SPOT entries should leak in.
    expect(futures.every((f) => f.market === "FUTURES")).toBe(true);
  });
});

describe("frontendSymbolFor", () => {
  it("is the inverse of backendMarketFor for registered symbols", () => {
    expect(frontendSymbolFor("BTC-USDB", "FUTURES")).toBe("BTC-PERP");
    expect(frontendSymbolFor("ETH-USDB", "FUTURES")).toBe("ETH-PERP");
    expect(frontendSymbolFor("SOL-USDB", "SPOT")).toBe("SOL-USDB");
  });

  it("falls back to the engine symbol itself when unregistered", () => {
    expect(frontendSymbolFor("DOGE-USDB", "SPOT")).toBe("DOGE-USDB");
  });
});

describe("backendOptionsMarketFor", () => {
  it("resolves the configured underlying for BTC", () => {
    expect(backendOptionsMarketFor("BTC")).toEqual({ symbol: "BTC-USDB", market: "OPTIONS" });
  });

  it("returns null for an asset with no options underlying configured", () => {
    expect(backendOptionsMarketFor("ETH")).toBeNull();
  });
});
