import { describe, it, expect } from "vitest";
import { backendMarketFor, backendOptionsMarketFor, frontendSymbolFor, registeredFuturesSymbols } from "./backendMarkets";

describe("backendMarketFor", () => {
  it("resolves all currently-registered symbols", () => {
    expect(backendMarketFor("BTC-BIUSDB")).toEqual({ symbol: "BTC-BIUSDB", market: "SPOT" });
    expect(backendMarketFor("ETH-BIUSDB")).toEqual({ symbol: "ETH-BIUSDB", market: "SPOT" });
    expect(backendMarketFor("SOL-BIUSDB")).toEqual({ symbol: "SOL-BIUSDB", market: "SPOT" });
    expect(backendMarketFor("BNB-BIUSDB")).toEqual({ symbol: "BNB-BIUSDB", market: "SPOT" });
    // Futures collateralize/settle in BIUSDB too — a distinct (symbol, market)
    // row from the SPOT entry of the same engine symbol name.
    expect(backendMarketFor("BTC-PERP")).toEqual({ symbol: "BTC-BIUSDB", market: "FUTURES" });
    expect(backendMarketFor("ETH-PERP")).toEqual({ symbol: "ETH-BIUSDB", market: "FUTURES" });
    // BI2X (added 2026-09-12): registered like any other spot/futures pair
    // even though its index-price feed isn't wired up yet — see
    // backendMarkets.ts's own comment on this entry.
    expect(backendMarketFor("BI2X-BIUSDB")).toEqual({ symbol: "BI2X-BIUSDB", market: "SPOT" });
    expect(backendMarketFor("BI2X-PERP")).toEqual({ symbol: "BI2X-BIUSDB", market: "FUTURES" });
  });

  it("returns null for a symbol with no backend market", () => {
    // This is the exact case that used to trigger a fake "order placed"
    // success toast in TradePanel.tsx — asserting it stays null pins the
    // contract the honest-error fix depends on.
    expect(backendMarketFor("DOGE-PERP")).toBeNull();
    expect(backendMarketFor("USDT-BIUSDB")).toBeNull();
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
    expect(futures).toContainEqual({ symbol: "BTC-BIUSDB", market: "FUTURES" });
    expect(futures).toContainEqual({ symbol: "ETH-BIUSDB", market: "FUTURES" });
    // No SPOT entries should leak in.
    expect(futures.every((f) => f.market === "FUTURES")).toBe(true);
  });

  it("is crypto-only while forex/commodities/stocks stay disabled", () => {
    // 5 crypto perps (BTC, ETH, SOL, BNB, BI2X) — the 9 non-crypto rows are
    // commented out of REGISTERED, see backendMarkets.ts.
    expect(registeredFuturesSymbols()).toHaveLength(5);
  });
});

describe("frontendSymbolFor", () => {
  it("is the inverse of backendMarketFor for registered symbols", () => {
    expect(frontendSymbolFor("BTC-BIUSDB", "FUTURES")).toBe("BTC-PERP");
    expect(frontendSymbolFor("ETH-BIUSDB", "FUTURES")).toBe("ETH-PERP");
    expect(frontendSymbolFor("SOL-BIUSDB", "SPOT")).toBe("SOL-BIUSDB");
  });

  it("falls back to the engine symbol itself when unregistered", () => {
    expect(frontendSymbolFor("DOGE-BIUSDB", "SPOT")).toBe("DOGE-BIUSDB");
    // GOLD/AAPL.us are disabled (commented out of REGISTERED) — falls back
    // to the raw engine symbol, same as any other unregistered pair.
    expect(frontendSymbolFor("GOLD-BIUSDB", "FUTURES")).toBe("GOLD-BIUSDB");
    expect(frontendSymbolFor("AAPL.us-BIUSDB", "FUTURES")).toBe("AAPL.us-BIUSDB");
  });
});

describe("backendOptionsMarketFor", () => {
  it("resolves the configured underlying for BTC", () => {
    expect(backendOptionsMarketFor("BTC")).toEqual({ symbol: "BTC-BIUSDB", market: "OPTIONS" });
  });

  it("returns null for an asset with no options underlying configured", () => {
    expect(backendOptionsMarketFor("ETH")).toBeNull();
  });
});
