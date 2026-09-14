import { calculateBookSpread, calculateBuyEstimate, calculateCumulativeBookLevels, calculateSellEstimate, findPredictionMarket, generatePriceHistory, getCountdownParts } from "./predictionMarkets";

describe("prediction market helpers", () => {
  it("calculates winning payout and profit from a dollar contract price", () => {
    const estimate = calculateBuyEstimate(20, 0.8);
    expect(estimate.shares).toBe(25);
    expect(estimate.payout).toBe(25);
    expect(estimate.profit).toBe(5);
  });

  it("protects buy calculations from invalid prices and amounts", () => {
    expect(calculateBuyEstimate(20, 0).shares).toBe(0);
    expect(calculateBuyEstimate("not-a-number", 0.62).payout).toBe(0);
  });

  it("caps a demo sale at the shares the user owns", () => {
    const estimate = calculateSellEstimate(30, 0.5, 12);
    expect(estimate.shares).toBe(12);
    expect(estimate.payout).toBe(6);
  });

  it("calculates cumulative order-book totals and spread", () => {
    const levels = calculateCumulativeBookLevels([{ price: 0.6, shares: 10 }, { price: 0.5, shares: 20 }]);
    expect(levels.map((level) => level.total)).toEqual([6, 16]);
    expect(calculateBookSpread({ outcomeId: "yes", lastPrice: 0.6, bids: [{ price: 0.59, shares: 1 }], asks: [{ price: 0.61, shares: 1 }] })).toBe(0.02);
  });

  it("finds the same shared fixture by id or slug", () => {
    expect(findPredictionMarket("btc-next-5m")).toBe(findPredictionMarket("btc-up-or-down-5m"));
  });

  it("generates stable, bounded mock history without random values", () => {
    const start = Date.UTC(2026, 8, 14);
    expect(generatePriceHistory(100, 5, 1, start)).toEqual(generatePriceHistory(100, 5, 1, start));
  });

  it("never returns a negative countdown", () => {
    const countdown = getCountdownParts("2026-01-01T00:00:00.000Z", Date.UTC(2026, 0, 2));
    expect(countdown).toMatchObject({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: true });
  });
});
