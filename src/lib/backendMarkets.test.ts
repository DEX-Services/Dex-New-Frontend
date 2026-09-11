import { describe, it, expect } from "vitest";
import { backendMarketFor, backendOptionsMarketFor, frontendSymbolFor, registeredFuturesSymbols } from "./backendMarkets";

describe("backendMarketFor", () => {
  it("resolves all currently-registered SPOT symbols (BI2X and BTC only)", () => {
    expect(backendMarketFor("BTC-BIUSDB")).toEqual({ symbol: "BTC-BIUSDB", market: "SPOT" });
    expect(backendMarketFor("BI2X-BIUSDB")).toEqual({ symbol: "BI2X-BIUSDB", market: "SPOT" });
  });

  it("resolves all currently-registered FUTURES symbols", () => {
    // Futures collateralize/settle in BIUSDB too — a distinct (symbol, market)
    // row from any SPOT entry of the same engine symbol name.
    expect(backendMarketFor("BTC-PERP")).toEqual({ symbol: "BTC-BIUSDB", market: "FUTURES" });
    expect(backendMarketFor("BI2X-PERP")).toEqual({ symbol: "BI2X-BIUSDB", market: "FUTURES" });
    // ETH, AVAX, LINK, SOL, DOGE, TAO, ADA, XRP: futures-only (2026-09-12
    // restructure) — no SPOT counterpart, but still real registered markets.
    expect(backendMarketFor("ETH-PERP")).toEqual({ symbol: "ETH-BIUSDB", market: "FUTURES" });
    expect(backendMarketFor("AVAX-PERP")).toEqual({ symbol: "AVAX-BIUSDB", market: "FUTURES" });
    expect(backendMarketFor("LINK-PERP")).toEqual({ symbol: "LINK-BIUSDB", market: "FUTURES" });
    expect(backendMarketFor("SOL-PERP")).toEqual({ symbol: "SOL-BIUSDB", market: "FUTURES" });
    expect(backendMarketFor("DOGE-PERP")).toEqual({ symbol: "DOGE-BIUSDB", market: "FUTURES" });
    expect(backendMarketFor("TAO-PERP")).toEqual({ symbol: "TAO-BIUSDB", market: "FUTURES" });
    expect(backendMarketFor("ADA-PERP")).toEqual({ symbol: "ADA-BIUSDB", market: "FUTURES" });
    expect(backendMarketFor("XRP-PERP")).toEqual({ symbol: "XRP-BIUSDB", market: "FUTURES" });
  });

  it("returns null for BNB and for ETH-BIUSDB/SOL-BIUSDB spot (removed 2026-09-12)", () => {
    // BNB was SPOT+FUTURES before the restructure and is now removed
    // entirely — neither entry should exist any more.
    expect(backendMarketFor("BNB-BIUSDB")).toBeNull();
    expect(backendMarketFor("BNB-PERP")).toBeNull();
    // ETH and SOL are still tradable (see the FUTURES case above) but their
    // SPOT rows were removed — the bare BASE-BIUSDB symbol must resolve to
    // nothing now, even though ETH-PERP/SOL-PERP still do.
    expect(backendMarketFor("ETH-BIUSDB")).toBeNull();
    expect(backendMarketFor("SOL-BIUSDB")).toBeNull();
  });

  it("returns null for a symbol with no backend market", () => {
    // This is the exact case that used to trigger a fake "order placed"
    // success toast in TradePanel.tsx — asserting it stays null pins the
    // contract the honest-error fix depends on.
    expect(backendMarketFor("SHIB-PERP")).toBeNull();
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

  it("matches the 2026-09-12 restructured market list exactly", () => {
    // BI2X, BTC, ETH, AVAX, LINK, SOL, DOGE, TAO, ADA, XRP — 10 total.
    // BNB is fully removed (was in this list before the restructure).
    const futures = registeredFuturesSymbols();
    expect(futures).toHaveLength(10);
    const bases = futures.map((f) => f.symbol.split("-")[0]).sort();
    expect(bases).toEqual(["ADA", "AVAX", "BI2X", "BTC", "DOGE", "ETH", "LINK", "SOL", "TAO", "XRP"]);
    expect(bases).not.toContain("BNB");
  });
});

describe("frontendSymbolFor", () => {
  it("is the inverse of backendMarketFor for registered symbols", () => {
    expect(frontendSymbolFor("BTC-BIUSDB", "FUTURES")).toBe("BTC-PERP");
    expect(frontendSymbolFor("ETH-BIUSDB", "FUTURES")).toBe("ETH-PERP");
    expect(frontendSymbolFor("BTC-BIUSDB", "SPOT")).toBe("BTC-BIUSDB");
  });

  it("falls back to the engine symbol itself when unregistered", () => {
    // SHIB was never registered at all.
    expect(frontendSymbolFor("SHIB-BIUSDB", "SPOT")).toBe("SHIB-BIUSDB");
    // SOL-BIUSDB SPOT was removed 2026-09-12 (SOL is futures-only now) —
    // falls back to the raw engine symbol, same as any other unregistered
    // (symbol, market) pair, even though SOL-PERP/FUTURES still resolves.
    expect(frontendSymbolFor("SOL-BIUSDB", "SPOT")).toBe("SOL-BIUSDB");
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
