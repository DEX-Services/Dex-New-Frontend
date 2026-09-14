// Frontend-only prediction-market fixtures and pure calculation helpers.
// Data and math stay separate from presentation so an API can replace these fixtures later.

export type PredictionCategory = "Crypto" | "Macro" | "Regulation" | "AI" | "Tech";
export type PredictionMarketType = "BINARY" | "PRICE_THRESHOLD" | "PRICE_DIRECTION";
export type PredictionMarketStatus = "OPEN" | "CLOSED" | "RESOLVED";
export type PredictionOutcomeTone = "positive" | "negative";

export type PredictionOutcome = { id: string; label: string; price: number; tone: PredictionOutcomeTone };
export type PredictionPricePoint = { timestamp: string; price: number };
export type PredictionBookLevel = { price: number; shares: number };
export type PredictionOutcomeBook = { outcomeId: string; bids: PredictionBookLevel[]; asks: PredictionBookLevel[]; lastPrice: number };

export type PredictionMarket = {
  id: string;
  slug: string;
  title: string;
  shortTitle: string;
  category: PredictionCategory;
  marketType: PredictionMarketType;
  status: PredictionMarketStatus;
  icon: string;
  description: string;
  rules: string[];
  edgeCase: string;
  volume: number;
  participants: number;
  startTime: string;
  endTime: string;
  resolutionDate: string;
  priceSource: string;
  symbol?: string;
  interval?: string;
  intervalMinutes?: 5 | 15;
  referencePrice?: number;
  currentPrice?: number;
  priceHistory?: PredictionPricePoint[];
  outcomes: PredictionOutcome[];
  orderBooks: PredictionOutcomeBook[];
  relatedMarketIds: string[];
};

export type PredictionTradeEstimate = { amount: number; contractPrice: number; shares: number; payout: number; profit: number };
export type PredictionCumulativeBookLevel = PredictionBookLevel & { total: number; depthPercent: number };
export type CountdownParts = { days: number; hours: number; minutes: number; seconds: number; expired: boolean };

const fixtureEpoch = Date.now();
const isoAfterMinutes = (minutes: number) => new Date(fixtureEpoch + minutes * 60_000).toISOString();
const isoAfterDays = (days: number) => isoAfterMinutes(days * 24 * 60);
const clampPrice = (value: number) => Math.min(0.99, Math.max(0.01, Number(value.toFixed(2))));

export function getCountdownParts(endTime: string, now = Date.now()): CountdownParts {
  const target = new Date(endTime).getTime();
  const remaining = Number.isFinite(target) ? Math.max(0, target - now) : 0;
  return {
    days: Math.floor(remaining / 86_400_000),
    hours: Math.floor((remaining % 86_400_000) / 3_600_000),
    minutes: Math.floor((remaining % 3_600_000) / 60_000),
    seconds: Math.floor((remaining % 60_000) / 1_000),
    expired: remaining === 0,
  };
}

export function generatePriceHistory(startPrice: number, points = 36, step = Math.max(startPrice * 0.00008, 0.01), startTime = fixtureEpoch - (points - 1) * 60_000): PredictionPricePoint[] {
  return Array.from({ length: points }, (_, index) => {
    const wave = Math.sin(index * 0.72) * step * 1.8 + Math.cos(index * 0.31) * step;
    const drift = (index - points / 2) * step * 0.12;
    return { timestamp: new Date(startTime + index * 60_000).toISOString(), price: Number((startPrice + wave + drift).toFixed(startPrice < 10 ? 4 : 2)) };
  });
}

function createOutcomeBooks(outcomeList: PredictionOutcome[], seed: number): PredictionOutcomeBook[] {
  return outcomeList.map((outcome, outcomeIndex) => ({
    outcomeId: outcome.id,
    bids: [36, 81, 132, 76, 104, 58].map((base, index) => ({
      price: clampPrice(outcome.price - (index + 1) * 0.01),
      shares: Number((base + seed * 3 + outcomeIndex * 11 + index * 4.7).toFixed(2)),
    })),
    asks: [42, 67, 118, 92, 61].map((base, index) => ({
      price: clampPrice(outcome.price + (index + 1) * 0.01),
      shares: Number((base + seed * 2 + outcomeIndex * 9 + index * 3.4).toFixed(2)),
    })),
    lastPrice: outcome.price,
  }));
}

function makeOutcomes(labels: [string, string], firstPrice: number): PredictionOutcome[] {
  return [
    { id: labels[0].toLowerCase(), label: labels[0], price: firstPrice, tone: "positive" },
    { id: labels[1].toLowerCase(), label: labels[1], price: Number((1 - firstPrice).toFixed(2)), tone: "negative" },
  ];
}

type FixtureInput = Omit<PredictionMarket, "outcomes" | "orderBooks"> & { outcomes: PredictionOutcome[]; bookSeed: number };
const fixture = ({ bookSeed, ...market }: FixtureInput): PredictionMarket => ({ ...market, orderBooks: createOutcomeBooks(market.outcomes, bookSeed) });

const btcDirection = makeOutcomes(["UP", "DOWN"], 0.62);
const ethDirection = makeOutcomes(["UP", "DOWN"], 0.54);
const solDirection = makeOutcomes(["UP", "DOWN"], 0.47);
const btcDirection15 = makeOutcomes(["UP", "DOWN"], 0.57);
const ethDirection15 = makeOutcomes(["UP", "DOWN"], 0.51);
const solDirection15 = makeOutcomes(["UP", "DOWN"], 0.44);
const btcThreshold = makeOutcomes(["YES", "NO"], 0.62);
const ethEtf = makeOutcomes(["YES", "NO"], 0.48);
const fedCut = makeOutcomes(["YES", "NO"], 0.71);
const solThreshold = makeOutcomes(["YES", "NO"], 0.34);
const aiTopTen = makeOutcomes(["YES", "NO"], 0.56);
const dominance = makeOutcomes(["YES", "NO"], 0.41);
const recession = makeOutcomes(["YES", "NO"], 0.29);
const ethFlip = makeOutcomes(["YES", "NO"], 0.18);
const appleWallet = makeOutcomes(["YES", "NO"], 0.22);

export const PREDICTION_MARKETS: PredictionMarket[] = [
  fixture({
    id: "btc-next-5m", slug: "btc-up-or-down-5m", title: "BTC Up or Down — Next 5 Minutes", shortTitle: "BTC Up or Down", category: "Crypto", marketType: "PRICE_DIRECTION", status: "OPEN", icon: "BTC", symbol: "BTC", interval: "5 Minutes", intervalMinutes: 5,
    description: "A short-duration market on whether Bitcoin finishes this five-minute window above its opening reference price.",
    rules: ["UP wins if the BTC reference price at the end time is strictly greater than the Price to Beat.", "DOWN wins if the end price is below or exactly equal to the Price to Beat.", "The displayed BitDx demo index is the reference source for this frontend preview."],
    edgeCase: "Equality counts as DOWN. If the reference feed is unavailable at the exact end time, the first valid price recorded immediately after the end time would be used by a future resolver.",
    volume: 428_400, participants: 1_240, startTime: isoAfterMinutes(-2), endTime: isoAfterMinutes(5), resolutionDate: isoAfterMinutes(5), priceSource: "BitDx BTC demo index", referencePrice: 77_345.05, currentPrice: 77_352.59,
    priceHistory: generatePriceHistory(77_348.4, 42, 1.45), outcomes: btcDirection, bookSeed: 3, relatedMarketIds: ["btc-next-15m", "eth-next-5m", "sol-next-5m"],
  }),
  fixture({
    id: "eth-next-5m", slug: "eth-up-or-down-5m", title: "ETH Up or Down — Next 5 Minutes", shortTitle: "ETH Up or Down", category: "Crypto", marketType: "PRICE_DIRECTION", status: "OPEN", icon: "ETH", symbol: "ETH", interval: "5 Minutes", intervalMinutes: 5,
    description: "A five-minute directional market for Ethereum's reference price.", rules: ["UP wins when the ending ETH price is strictly above the opening reference price.", "DOWN wins when the ending price is equal to or below the opening reference price."], edgeCase: "Equality counts as DOWN.",
    volume: 186_200, participants: 684, startTime: isoAfterMinutes(-1), endTime: isoAfterMinutes(6), resolutionDate: isoAfterMinutes(6), priceSource: "BitDx ETH demo index", referencePrice: 3_521.8, currentPrice: 3_524.25,
    priceHistory: generatePriceHistory(3_522.1, 42, 0.52), outcomes: ethDirection, bookSeed: 5, relatedMarketIds: ["eth-next-15m", "btc-next-5m", "sol-next-5m"],
  }),
  fixture({
    id: "sol-next-5m", slug: "sol-up-or-down-5m", title: "SOL Up or Down — Next 5 Minutes", shortTitle: "SOL Up or Down", category: "Crypto", marketType: "PRICE_DIRECTION", status: "OPEN", icon: "SOL", symbol: "SOL", interval: "5 Minutes", intervalMinutes: 5,
    description: "A five-minute directional market for Solana's reference price.", rules: ["UP wins when the ending SOL price is strictly above the opening reference price.", "DOWN wins when the ending price is equal to or below the opening reference price."], edgeCase: "Equality counts as DOWN.",
    volume: 122_900, participants: 438, startTime: isoAfterMinutes(-3), endTime: isoAfterMinutes(4), resolutionDate: isoAfterMinutes(4), priceSource: "BitDx SOL demo index", referencePrice: 168.42, currentPrice: 168.31,
    priceHistory: generatePriceHistory(168.38, 42, 0.08), outcomes: solDirection, bookSeed: 7, relatedMarketIds: ["sol-next-15m", "btc-next-5m", "eth-next-5m"],
  }),
  fixture({
    id: "btc-next-15m", slug: "btc-up-or-down-15m", title: "BTC Up or Down — Next 15 Minutes", shortTitle: "BTC Up or Down", category: "Crypto", marketType: "PRICE_DIRECTION", status: "OPEN", icon: "BTC", symbol: "BTC", interval: "15 Minutes", intervalMinutes: 15,
    description: "A 15-minute market on whether Bitcoin finishes above its opening reference price.",
    rules: ["UP wins if the BTC reference price at the end of the 15-minute window is strictly greater than the Price to Beat.", "DOWN wins if the end price is below or exactly equal to the Price to Beat."], edgeCase: "Equality counts as DOWN.",
    volume: 612_800, participants: 1_486, startTime: isoAfterMinutes(-4), endTime: isoAfterMinutes(11), resolutionDate: isoAfterMinutes(11), priceSource: "BitDx BTC demo index", referencePrice: 77_346.8, currentPrice: 77_352.59,
    priceHistory: generatePriceHistory(77_347.2, 48, 1.6), outcomes: btcDirection15, bookSeed: 4, relatedMarketIds: ["btc-next-5m", "eth-next-15m", "sol-next-15m"],
  }),
  fixture({
    id: "eth-next-15m", slug: "eth-up-or-down-15m", title: "ETH Up or Down — Next 15 Minutes", shortTitle: "ETH Up or Down", category: "Crypto", marketType: "PRICE_DIRECTION", status: "OPEN", icon: "ETH", symbol: "ETH", interval: "15 Minutes", intervalMinutes: 15,
    description: "A 15-minute directional market for Ethereum's reference price.", rules: ["UP wins when the ending ETH price is strictly above the opening reference price.", "DOWN wins when the ending price is equal to or below the opening reference price."], edgeCase: "Equality counts as DOWN.",
    volume: 274_600, participants: 802, startTime: isoAfterMinutes(-6), endTime: isoAfterMinutes(9), resolutionDate: isoAfterMinutes(9), priceSource: "BitDx ETH demo index", referencePrice: 3_521.4, currentPrice: 3_524.25,
    priceHistory: generatePriceHistory(3_522.4, 48, 0.58), outcomes: ethDirection15, bookSeed: 6, relatedMarketIds: ["eth-next-5m", "btc-next-15m", "sol-next-15m"],
  }),
  fixture({
    id: "sol-next-15m", slug: "sol-up-or-down-15m", title: "SOL Up or Down — Next 15 Minutes", shortTitle: "SOL Up or Down", category: "Crypto", marketType: "PRICE_DIRECTION", status: "OPEN", icon: "SOL", symbol: "SOL", interval: "15 Minutes", intervalMinutes: 15,
    description: "A 15-minute directional market for Solana's reference price.", rules: ["UP wins when the ending SOL price is strictly above the opening reference price.", "DOWN wins when the ending price is equal to or below the opening reference price."], edgeCase: "Equality counts as DOWN.",
    volume: 194_300, participants: 526, startTime: isoAfterMinutes(-8), endTime: isoAfterMinutes(7), resolutionDate: isoAfterMinutes(7), priceSource: "BitDx SOL demo index", referencePrice: 168.46, currentPrice: 168.31,
    priceHistory: generatePriceHistory(168.4, 48, 0.09), outcomes: solDirection15, bookSeed: 8, relatedMarketIds: ["sol-next-5m", "btc-next-15m", "eth-next-15m"],
  }),
  fixture({
    id: "btc-80k", slug: "btc-above-80k-year-end", title: "Will BTC close above $80k by year-end?", shortTitle: "BTC above $80k", category: "Crypto", marketType: "PRICE_THRESHOLD", status: "OPEN", icon: "BTC", symbol: "BTC", interval: "Year-end",
    description: "Tracks whether Bitcoin's reference price will finish above $80,000 at the stated year-end resolution time.", rules: ["YES wins if the BTC reference price is strictly above $80,000 at resolution.", "NO wins if the price is $80,000 or lower."], edgeCase: "Equality at exactly $80,000 counts as NO.",
    volume: 4_200_000, participants: 1_240, startTime: isoAfterDays(-30), endTime: isoAfterDays(108), resolutionDate: isoAfterDays(108), priceSource: "BitDx BTC demo index", referencePrice: 80_000, currentPrice: 77_352.59,
    priceHistory: generatePriceHistory(77_100, 42, 92), outcomes: btcThreshold, bookSeed: 9, relatedMarketIds: ["btc-next-5m", "btc-dominance", "eth-flip"],
  }),
  fixture({
    id: "eth-etf", slug: "eth-etf-q3-2026", title: "ETH ETF approved by Q3 2026?", shortTitle: "ETH ETF approval", category: "Regulation", marketType: "BINARY", status: "OPEN", icon: "ETH",
    description: "Predicts whether the specified Ethereum exchange-traded fund receives formal regulatory approval before the deadline.", rules: ["YES wins if the regulator publishes a final approval before the market end time.", "NO wins if approval is rejected, withdrawn, or not published before the deadline."], edgeCase: "A filing or preliminary statement without final approval does not count.",
    volume: 2_100_000, participants: 890, startTime: isoAfterDays(-48), endTime: isoAfterDays(16), resolutionDate: isoAfterDays(16), priceSource: "Official regulator publication", outcomes: ethEtf, bookSeed: 11, relatedMarketIds: ["eth-next-5m", "btc-80k", "apple-wallet"],
  }),
  fixture({
    id: "fed-cut", slug: "fed-rate-cut-next-meeting", title: "Will the Fed cut rates next meeting?", shortTitle: "Fed rate cut", category: "Macro", marketType: "BINARY", status: "OPEN", icon: "FED",
    description: "Predicts whether the Federal Reserve lowers its target rate at its next scheduled decision.", rules: ["YES wins if the upper bound of the target range is lower immediately after the next scheduled decision.", "NO wins if it is unchanged or raised."], edgeCase: "An unscheduled move before the meeting does not settle this market unless confirmed by the scheduled decision.",
    volume: 1_800_000, participants: 2_100, startTime: isoAfterDays(-18), endTime: isoAfterDays(33), resolutionDate: isoAfterDays(33), priceSource: "Federal Reserve statement", outcomes: fedCut, bookSeed: 13, relatedMarketIds: ["us-recession", "btc-dominance", "eth-etf"],
  }),
  fixture({
    id: "sol-300", slug: "sol-above-300-august", title: "SOL > $300 by August?", shortTitle: "SOL above $300", category: "Crypto", marketType: "PRICE_THRESHOLD", status: "OPEN", icon: "SOL", symbol: "SOL", interval: "Monthly",
    description: "Tracks whether Solana trades above $300 at the market resolution time.", rules: ["YES wins if SOL is strictly above $300 at resolution.", "NO wins at $300 or below."], edgeCase: "Equality counts as NO.",
    volume: 980_000, participants: 560, startTime: isoAfterDays(-24), endTime: isoAfterDays(82), resolutionDate: isoAfterDays(82), priceSource: "BitDx SOL demo index", referencePrice: 300, currentPrice: 168.42,
    priceHistory: generatePriceHistory(166.9, 42, 0.7), outcomes: solThreshold, bookSeed: 15, relatedMarketIds: ["sol-next-5m", "btc-80k", "eth-flip"],
  }),
  fixture({
    id: "ai-top10", slug: "ai-token-top-ten-q4", title: "New AI token in the top 10 by Q4?", shortTitle: "AI token top 10", category: "AI", marketType: "BINARY", status: "OPEN", icon: "AI",
    description: "Predicts whether a token primarily categorized as AI enters the top ten crypto assets by market capitalization before the deadline.", rules: ["YES wins if an eligible AI token appears in the top ten for a continuous 24-hour period.", "NO wins if no eligible token meets that condition."], edgeCase: "Wrapped assets and stablecoins are excluded from the ranking.",
    volume: 640_000, participants: 340, startTime: isoAfterDays(-12), endTime: isoAfterDays(47), resolutionDate: isoAfterDays(47), priceSource: "BitDx composite market-cap snapshot", outcomes: aiTopTen, bookSeed: 17, relatedMarketIds: ["apple-wallet", "eth-flip", "btc-dominance"],
  }),
  fixture({
    id: "btc-dominance", slug: "btc-dominance-above-60", title: "BTC dominance stays above 60%?", shortTitle: "BTC dominance above 60%", category: "Crypto", marketType: "PRICE_THRESHOLD", status: "OPEN", icon: "BTC", symbol: "BTC.D",
    description: "Predicts whether Bitcoin dominance is above 60% at resolution.", rules: ["YES wins if the reference BTC dominance value is strictly greater than 60% at resolution.", "NO wins at 60% or lower."], edgeCase: "Exactly 60% counts as NO.",
    volume: 1_200_000, participants: 780, startTime: isoAfterDays(-20), endTime: isoAfterDays(61), resolutionDate: isoAfterDays(61), priceSource: "BitDx composite dominance index", referencePrice: 60, currentPrice: 58.7,
    priceHistory: generatePriceHistory(58.4, 42, 0.07), outcomes: dominance, bookSeed: 19, relatedMarketIds: ["btc-80k", "eth-flip", "ai-top10"],
  }),
  fixture({
    id: "us-recession", slug: "us-recession-2026", title: "US recession confirmed in 2026?", shortTitle: "US recession in 2026", category: "Macro", marketType: "BINARY", status: "OPEN", icon: "US",
    description: "Predicts whether the designated economic authority confirms a US recession during 2026.", rules: ["YES wins on a formal recession designation covering any period in 2026.", "NO wins if no such designation is made by the resolution deadline."], edgeCase: "Two negative GDP quarters alone do not settle the market without the stated formal designation.",
    volume: 2_400_000, participants: 1_560, startTime: isoAfterDays(-72), endTime: isoAfterDays(120), resolutionDate: isoAfterDays(120), priceSource: "Official economic releases", outcomes: recession, bookSeed: 21, relatedMarketIds: ["fed-cut", "btc-dominance", "eth-etf"],
  }),
  fixture({
    id: "eth-flip", slug: "ethereum-flips-bitcoin", title: "Will Ethereum flip Bitcoin in market cap?", shortTitle: "Ethereum flips Bitcoin", category: "Crypto", marketType: "BINARY", status: "OPEN", icon: "ETH",
    description: "Predicts whether Ethereum's circulating market capitalization exceeds Bitcoin's before the deadline.", rules: ["YES wins if ETH market capitalization closes above BTC market capitalization for one full UTC day.", "NO wins if this never occurs before resolution."], edgeCase: "A brief intraday crossover does not count.",
    volume: 890_000, participants: 420, startTime: isoAfterDays(-90), endTime: isoAfterDays(140), resolutionDate: isoAfterDays(140), priceSource: "BitDx composite market-cap snapshot", outcomes: ethFlip, bookSeed: 23, relatedMarketIds: ["eth-next-5m", "btc-80k", "btc-dominance"],
  }),
  fixture({
    id: "apple-wallet", slug: "apple-crypto-wallet-year-end", title: "Apple launches a crypto wallet by year-end?", shortTitle: "Apple crypto wallet", category: "Tech", marketType: "BINARY", status: "OPEN", icon: "APL",
    description: "Predicts whether Apple publicly releases a first-party product that can hold and transfer cryptocurrency before year-end.", rules: ["YES wins on a publicly available first-party Apple crypto wallet release.", "NO wins if only third-party wallet integrations exist at the deadline."], edgeCase: "Announcements without a public release do not count.",
    volume: 540_000, participants: 290, startTime: isoAfterDays(-35), endTime: isoAfterDays(108), resolutionDate: isoAfterDays(108), priceSource: "Official Apple product announcements", outcomes: appleWallet, bookSeed: 25, relatedMarketIds: ["ai-top10", "eth-etf", "btc-80k"],
  }),
];

export const PREDICTION_CATEGORIES: (PredictionCategory | "All")[] = ["All", "Crypto", "Macro", "Regulation", "AI", "Tech"];
export const CATEGORY_BADGE_CLASS: Record<PredictionCategory, string> = {
  Crypto: "bg-warning/10 text-warning border-warning/25",
  Macro: "bg-primary/10 text-primary border-primary/25",
  Regulation: "bg-secondary/10 text-secondary border-secondary/25",
  AI: "bg-primary/10 text-primary border-primary/25",
  Tech: "bg-buy/10 text-buy border-buy/25",
};

export function findPredictionMarket(idOrSlug: string | undefined): PredictionMarket | undefined {
  return PREDICTION_MARKETS.find((market) => market.id === idOrSlug || market.slug === idOrSlug);
}

export function getPredictionOutcome(market: PredictionMarket, outcomeId: string | undefined): PredictionOutcome {
  return market.outcomes.find((outcome) => outcome.id === outcomeId) ?? market.outcomes[0];
}

export function calculateBuyEstimate(amountInput: string | number, contractPrice: number): PredictionTradeEstimate {
  const amount = typeof amountInput === "number" ? amountInput : Number(amountInput);
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(contractPrice) || contractPrice <= 0 || contractPrice > 1) {
    return { amount: 0, contractPrice: Number.isFinite(contractPrice) ? contractPrice : 0, shares: 0, payout: 0, profit: 0 };
  }
  const shares = amount / contractPrice;
  return { amount, contractPrice, shares, payout: shares, profit: shares - amount };
}

export function calculateSellEstimate(sharesInput: string | number, contractPrice: number, availableShares: number): PredictionTradeEstimate {
  const requested = typeof sharesInput === "number" ? sharesInput : Number(sharesInput);
  if (!Number.isFinite(requested) || requested <= 0 || !Number.isFinite(contractPrice) || contractPrice <= 0 || contractPrice > 1 || availableShares <= 0) {
    return { amount: 0, contractPrice: Number.isFinite(contractPrice) ? contractPrice : 0, shares: 0, payout: 0, profit: 0 };
  }
  const shares = Math.min(requested, availableShares);
  const proceeds = shares * contractPrice;
  return { amount: proceeds, contractPrice, shares, payout: proceeds, profit: 0 };
}

export function calculateCumulativeBookLevels(levels: PredictionBookLevel[]): PredictionCumulativeBookLevel[] {
  const maxShares = Math.max(0, ...levels.map((level) => level.shares));
  let total = 0;
  return levels.map((level) => {
    total += level.price * level.shares;
    return { ...level, total: Number(total.toFixed(2)), depthPercent: maxShares > 0 ? (level.shares / maxShares) * 100 : 0 };
  });
}

export function calculateBookSpread(book: PredictionOutcomeBook): number {
  if (book.bids.length === 0 || book.asks.length === 0) return 0;
  return Math.max(0, Number((Math.min(...book.asks.map((level) => level.price)) - Math.max(...book.bids.map((level) => level.price))).toFixed(2)));
}

export const formatContractPrice = (price: number) => `${Math.round(price * 100)}¢`;
export const formatPredictionCurrency = (value: number, maximumFractionDigits = 2) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits }).format(value);
export const formatPredictionVolume = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value);
export const formatPredictionDate = (value: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));

export type PredictionSide = "YES" | "NO";
export type PredictionOrderStatus = "Open" | "Won" | "Lost";
export type PredictionOrder = { id: string; marketId: string; question: string; side: PredictionSide; status: PredictionOrderStatus; placedAt: string; priceCents: number; shares: number; cost: number };

export const PREDICTION_ORDERS: PredictionOrder[] = [
  { id: "PRD-000482", marketId: "sol-300", question: "SOL > $300 by August?", side: "YES", status: "Open", placedAt: "2026-09-10 15:12", priceCents: 34, shares: 73.52, cost: 25 },
  { id: "PRD-000481", marketId: "btc-80k", question: "Will BTC close above $80k by year-end?", side: "YES", status: "Open", placedAt: "2026-09-10 14:48", priceCents: 62, shares: 161.29, cost: 100 },
  { id: "PRD-000455", marketId: "fed-cut", question: "Will the Fed cut rates next meeting?", side: "NO", status: "Won", placedAt: "2026-09-08 18:20", priceCents: 29, shares: 86.2, cost: 25 },
  { id: "PRD-000430", marketId: "eth-etf", question: "ETH ETF approved by Q3 2026?", side: "YES", status: "Lost", placedAt: "2026-09-05 10:05", priceCents: 48, shares: 20.83, cost: 10 },
];

export function orderStatusBadgeClass(status: PredictionOrderStatus): string {
  if (status === "Open") return "bg-primary/15 text-primary border-primary/30";
  if (status === "Won") return "bg-buy/15 text-buy border-buy/30";
  return "bg-sell/15 text-sell border-sell/30";
}

export function sidePillClass(side: PredictionSide): string {
  return side === "YES" ? "rounded bg-buy/15 px-2 py-0.5 text-[10px] font-bold text-buy" : "rounded bg-sell/15 px-2 py-0.5 text-[10px] font-bold text-sell";
}
