import type {
  PredictionMarket,
  PredictionOutcome,
  PredictionOutcomeBook,
  PredictionPricePoint,
} from "@/lib/predictionMarkets";

export const DIRECTION_INTERVAL_MS = 5 * 60 * 1_000;

export type PredictionIntervalState = "PAST" | "LIVE" | "UPCOMING";

export type PredictionIntervalOption = {
  startTime: number;
  endTime: number;
  state: PredictionIntervalState;
};

const clampContractPrice = (value: number) => Math.min(0.95, Math.max(0.05, Number(value.toFixed(2))));

export function getDirectionIntervalStart(now: number, intervalMs = DIRECTION_INTERVAL_MS): number {
  return Math.floor(now / intervalMs) * intervalMs;
}

export function getPredictionIntervalState(startTime: number, now: number, intervalMs = DIRECTION_INTERVAL_MS): PredictionIntervalState {
  if (now < startTime) return "UPCOMING";
  if (now >= startTime + intervalMs) return "PAST";
  return "LIVE";
}

export function getPredictionIntervalOptions(now: number, offsets: number[], intervalMs = DIRECTION_INTERVAL_MS): PredictionIntervalOption[] {
  const currentStart = getDirectionIntervalStart(now, intervalMs);
  return offsets.map((offset) => {
    const startTime = currentStart + offset * intervalMs;
    return { startTime, endTime: startTime + intervalMs, state: getPredictionIntervalState(startTime, now, intervalMs) };
  });
}

function marketSeed(market: PredictionMarket): number {
  return [...market.id].reduce((total, character) => total + character.charCodeAt(0), 0) * 0.013;
}

export function getSimulationAmplitude(market: PredictionMarket): number {
  const prices = market.priceHistory?.map((point) => point.price) ?? [];
  const range = prices.length > 1 ? Math.max(...prices) - Math.min(...prices) : 0;
  const currentPrice = market.currentPrice ?? market.referencePrice ?? 1;
  return Math.max(range / 4, currentPrice * 0.00002, currentPrice < 10 ? 0.005 : 0.02);
}

export function simulateUnderlyingPrice(market: PredictionMarket, timestamp: number): number {
  const lastFixturePoint = market.priceHistory?.at(-1);
  const anchorTime = lastFixturePoint ? new Date(lastFixturePoint.timestamp).getTime() : new Date(market.startTime).getTime();
  const anchorPrice = market.currentPrice ?? lastFixturePoint?.price ?? market.referencePrice ?? 0;
  const seconds = (timestamp - anchorTime) / 1_000;
  const seed = marketSeed(market);
  const amplitude = getSimulationAmplitude(market);
  const wave =
    (Math.sin(seconds / 18 + seed) - Math.sin(seed)) * amplitude * 0.72
    + (Math.sin(seconds / 43 + seed * 0.6) - Math.sin(seed * 0.6)) * amplitude * 0.43
    + (Math.cos(seconds / 91 + seed * 0.3) - Math.cos(seed * 0.3)) * amplitude * 0.24;
  const precision = anchorPrice < 10 ? 4 : 2;
  return Number(Math.max(0.0001, anchorPrice + wave).toFixed(precision));
}

export function calculateDirectionOutcomePrices(
  referencePrice: number,
  currentPrice: number,
  startTime: number,
  endTime: number,
  now: number,
  amplitude: number,
): [number, number] {
  if (now >= endTime) {
    return currentPrice > referencePrice ? [0.99, 0.01] : [0.01, 0.99];
  }
  if (now < startTime) return [0.5, 0.5];

  const duration = Math.max(1, endTime - startTime);
  const remainingRatio = Math.max(0, Math.min(1, (endTime - now) / duration));
  const uncertainty = Math.max(amplitude * (0.9 + 2.5 * Math.sqrt(remainingRatio)), Math.abs(referencePrice) * 0.00001, 0.001);
  const upPrice = clampContractPrice(0.5 + Math.tanh((currentPrice - referencePrice) / uncertainty) * 0.44);
  return [upPrice, Number((1 - upPrice).toFixed(2))];
}

function createLiveHistory(market: PredictionMarket, displayEnd: number): PredictionPricePoint[] {
  const start = displayEnd - 30 * 60 * 1_000;
  const pointSpacing = 30 * 1_000;
  const history = Array.from({ length: 61 }, (_, index) => {
    const timestamp = Math.min(displayEnd, start + index * pointSpacing);
    return { timestamp: new Date(timestamp).toISOString(), price: simulateUnderlyingPrice(market, timestamp) };
  });
  if (new Date(history.at(-1)!.timestamp).getTime() !== displayEnd) {
    history.push({ timestamp: new Date(displayEnd).toISOString(), price: simulateUnderlyingPrice(market, displayEnd) });
  }
  return history;
}

function repriceBook(book: PredictionOutcomeBook, price: number): PredictionOutcomeBook {
  return {
    ...book,
    lastPrice: price,
    bids: book.bids.map((level, index) => ({ ...level, price: Math.max(0.01, Number((price - (index + 1) * 0.01).toFixed(2))) })),
    asks: book.asks.map((level, index) => ({ ...level, price: Math.min(0.99, Number((price + (index + 1) * 0.01).toFixed(2))) })),
  };
}

export function createLivePredictionMarketSnapshot(
  market: PredictionMarket,
  windowStart: number,
  now: number,
  intervalMs = DIRECTION_INTERVAL_MS,
): { market: PredictionMarket; intervalState: PredictionIntervalState } {
  if (market.marketType !== "PRICE_DIRECTION" || market.currentPrice === undefined) {
    return { market, intervalState: getPredictionIntervalState(new Date(market.startTime).getTime(), now, new Date(market.endTime).getTime() - new Date(market.startTime).getTime()) };
  }

  const endTime = windowStart + intervalMs;
  const intervalState = getPredictionIntervalState(windowStart, now, intervalMs);
  const displayTime = intervalState === "PAST" ? endTime : now;
  const referencePrice = simulateUnderlyingPrice(market, windowStart);
  const currentPrice = simulateUnderlyingPrice(market, displayTime);
  const [firstPrice, secondPrice] = calculateDirectionOutcomePrices(
    referencePrice,
    currentPrice,
    windowStart,
    endTime,
    now,
    getSimulationAmplitude(market),
  );
  const outcomes: PredictionOutcome[] = market.outcomes.map((outcome, index) => ({
    ...outcome,
    price: index === 0 ? firstPrice : secondPrice,
  }));
  const outcomePrices = new Map(outcomes.map((outcome) => [outcome.id, outcome.price]));

  return {
    intervalState,
    market: {
      ...market,
      status: intervalState === "PAST" ? "RESOLVED" : "OPEN",
      startTime: new Date(windowStart).toISOString(),
      endTime: new Date(endTime).toISOString(),
      resolutionDate: new Date(endTime).toISOString(),
      referencePrice,
      currentPrice,
      priceHistory: createLiveHistory(market, displayTime),
      outcomes,
      orderBooks: market.orderBooks.map((book) => repriceBook(book, outcomePrices.get(book.outcomeId) ?? book.lastPrice)),
    },
  };
}
