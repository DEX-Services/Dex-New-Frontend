import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useLivePrice } from "./useLivePrice";

// Regression test for the exact bug reported: MarketHeader showed a real
// index price (e.g. $79,602) while the order entry panel defaulted to a
// stale mock price ($67,432.50) baked into mockData.ts, because the two
// derived "current price" independently instead of sharing one hook. This
// pins useLivePrice's priority order — real index price wins whenever the
// feed is live, the mock market price is a fallback only — so both
// MarketHeader and the trade page's order panel are structurally
// guaranteed to agree (they call the same hook), not just coincidentally
// in sync today.

function mockIndexFetch(price: number | null) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () =>
      price === null
        ? Promise.reject(new Error("no data"))
        : {
            base: "BTC",
            price: String(price),
            fresh: true,
            ageMs: 100,
            changePercent: 1.5,
            high: price * 1.02,
            low: price * 0.98,
            quoteVolume: 1_000_000,
          },
  });
}

describe("useLivePrice", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockIndexFetch(79602.01));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prefers the real index price over the mock market price for a crypto symbol", async () => {
    const { result } = renderHook(() => useLivePrice("BTC-PERP"));

    await waitFor(() => {
      // The mock seed for BTC-PERP is 67432.5 (mockData.ts) — the real
      // index price must win, not that stale number.
      expect(result.current).toBeCloseTo(79602.01, 2);
    });
  });

  it("returns a positive number immediately from the mock market feed while the index request is in flight", async () => {
    // Before the async index fetch resolves, the hook must not return 0/NaN
    // for a known symbol — it should fall back to the mock market price
    // synchronously on first render, same as before this fix, just no
    // longer stuck there once the real price arrives. unmount() before the
    // index fetch/useMarkets' background tick can land a state update after
    // the test returns (harmless in practice, just noisy in test output).
    const { result, unmount } = renderHook(() => useLivePrice("BTC-PERP"));
    expect(result.current).toBeGreaterThan(0);
    unmount();
  });

  it("returns 0 for a completely unknown symbol", () => {
    const { result } = renderHook(() => useLivePrice("NOT-A-REAL-SYMBOL"));
    expect(result.current).toBe(0);
  });
});
