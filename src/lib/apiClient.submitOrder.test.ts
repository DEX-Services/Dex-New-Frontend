import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { submitOrder } from "./apiClient";

// submitOrder builds the /order query string that the matching engine's
// HTTP handler parses. The engine only recognises STOP / POST_ONLY /
// reduceOnly / stopPrice / slippageBps once those params are actually sent
// (see matching-engine/cmd/engine/main.go) — these tests pin down that the
// frontend client emits exactly the params the fixed handler expects, so a
// regression here (e.g. someone renaming a field) is caught even without a
// live backend to submit against.

function mockOkFetch() {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ orderId: "abc-123", status: "OPEN", filled: "0", trades: 0 }),
  });
}

describe("submitOrder query construction", () => {
  let fetchSpy: ReturnType<typeof mockOkFetch>;

  beforeEach(() => {
    fetchSpy = mockOkFetch();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function calledUrl(): URL {
    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    return new URL(url);
  }

  it("sends a plain LIMIT order without stop/reduceOnly/slippage params", async () => {
    await submitOrder({
      account: "acct-1", symbol: "BTC-USDC", market: "FUTURES",
      side: "BUY", type: "LIMIT", price: "50000", qty: "1",
    });
    const params = calledUrl().searchParams;
    expect(params.get("type")).toBe("LIMIT");
    expect(params.has("stopPrice")).toBe(false);
    expect(params.has("reduceOnly")).toBe(false);
    expect(params.has("slippageBps")).toBe(false);
  });

  it("sends type=STOP with stopPrice for a stop order", async () => {
    await submitOrder({
      account: "acct-1", symbol: "BTC-USDC", market: "FUTURES",
      side: "SELL", type: "STOP", stopPrice: "48000", qty: "1",
    });
    const params = calledUrl().searchParams;
    expect(params.get("type")).toBe("STOP");
    expect(params.get("stopPrice")).toBe("48000");
  });

  it("sends reduceOnly=true only when explicitly set", async () => {
    await submitOrder({
      account: "acct-1", symbol: "BTC-USDC", market: "FUTURES",
      side: "SELL", type: "STOP", stopPrice: "48000", qty: "1", reduceOnly: true,
    });
    expect(calledUrl().searchParams.get("reduceOnly")).toBe("true");
  });

  it("omits reduceOnly entirely when false or unset (never sends reduceOnly=false)", async () => {
    await submitOrder({
      account: "acct-1", symbol: "BTC-USDC", market: "FUTURES",
      side: "BUY", type: "LIMIT", price: "50000", qty: "1", reduceOnly: false,
    });
    expect(calledUrl().searchParams.has("reduceOnly")).toBe(false);
  });

  it("sends slippageBps for a market order with a slippage cap", async () => {
    await submitOrder({
      account: "acct-1", symbol: "BTC-USDC", market: "SPOT",
      side: "BUY", type: "MARKET", qty: "1", slippageBps: 50,
    });
    const params = calledUrl().searchParams;
    expect(params.get("type")).toBe("MARKET");
    expect(params.get("slippageBps")).toBe("50");
  });

  it("sends type=POST_ONLY unchanged (not silently downgraded client-side)", async () => {
    await submitOrder({
      account: "acct-1", symbol: "BTC-USDC", market: "SPOT",
      side: "BUY", type: "POST_ONLY", price: "50000", qty: "1",
    });
    expect(calledUrl().searchParams.get("type")).toBe("POST_ONLY");
  });
});
