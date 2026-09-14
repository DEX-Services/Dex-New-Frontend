import { findPredictionMarket } from "./predictionMarkets";
import {
  DIRECTION_INTERVAL_MS,
  calculateDirectionOutcomePrices,
  createLivePredictionMarketSnapshot,
  getDirectionIntervalStart,
  getPredictionIntervalOptions,
  simulateUnderlyingPrice,
} from "./predictionSimulation";

describe("live prediction market simulation", () => {
  const market = findPredictionMarket("btc-next-5m")!;
  const now = Date.UTC(2026, 8, 14, 12, 3, 42);

  it("aligns short markets to exact five-minute windows", () => {
    const start = getDirectionIntervalStart(now);
    expect(start).toBe(Date.UTC(2026, 8, 14, 12, 0));
    expect(getPredictionIntervalOptions(now, [-1, 0, 1]).map((option) => option.state)).toEqual(["PAST", "LIVE", "UPCOMING"]);
  });

  it("uses a full 15-minute window for 15-minute market fixtures", () => {
    const fifteenMinuteMarket = findPredictionMarket("btc-next-15m")!;
    const intervalMs = fifteenMinuteMarket.intervalMinutes! * 60_000;
    const start = getDirectionIntervalStart(now, intervalMs);
    const snapshot = createLivePredictionMarketSnapshot(fifteenMinuteMarket, start, now, intervalMs).market;
    expect(new Date(snapshot.endTime).getTime() - new Date(snapshot.startTime).getTime()).toBe(15 * 60_000);
  });

  it("produces deterministic underlying prices for a timestamp", () => {
    expect(simulateUnderlyingPrice(market, now)).toBe(simulateUnderlyingPrice(market, now));
  });

  it("keeps live direction prices complementary and bounded", () => {
    const [up, down] = calculateDirectionOutcomePrices(100, 101, now - 60_000, now + 60_000, now, 1);
    expect(up + down).toBe(1);
    expect(up).toBeGreaterThanOrEqual(0.05);
    expect(up).toBeLessThanOrEqual(0.95);
  });

  it("advances the current price and contract quote during a live interval", () => {
    const start = getDirectionIntervalStart(now);
    const first = createLivePredictionMarketSnapshot(market, start, start + 45_000).market;
    const later = createLivePredictionMarketSnapshot(market, start, start + 75_000).market;
    expect(later.currentPrice).not.toBe(first.currentPrice);
    expect(later.outcomes[0].price).not.toBe(first.outcomes[0].price);
  });

  it("resolves past windows and reprices their order books", () => {
    const start = getDirectionIntervalStart(now) - DIRECTION_INTERVAL_MS;
    const snapshot = createLivePredictionMarketSnapshot(market, start, now);
    expect(snapshot.intervalState).toBe("PAST");
    expect(snapshot.market.status).toBe("RESOLVED");
    expect(snapshot.market.outcomes[0].price + snapshot.market.outcomes[1].price).toBe(1);
    expect(snapshot.market.orderBooks[0].lastPrice).toBe(snapshot.market.outcomes[0].price);
    expect(snapshot.market.priceHistory).toHaveLength(61);
  });
});
