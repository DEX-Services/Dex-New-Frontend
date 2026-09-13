// Prediction markets: a UI-only mock feature (no backend endpoint exists for
// it — same as when it first shipped). Buying YES/NO here does not touch a
// real balance or settle anywhere; see PredictionDetailModal/Prediction.tsx
// for where this data is consumed.

export type PredictionCategory = "Crypto" | "Macro" | "Regulation" | "AI" | "Tech";

export type PredictionMarket = {
  id: string;
  question: string;
  category: PredictionCategory;
  yesPct: number; // implied probability, 0-100
  volume: string; // display string, e.g. "$4.2M"
  participants: number;
  closes: string; // display string, e.g. "Dec 31"
};

export const PREDICTION_MARKETS: PredictionMarket[] = [
  { id: "btc-80k", question: "Will BTC close above $80k by year-end?", category: "Crypto", yesPct: 62, volume: "$4.2M", participants: 1240, closes: "Dec 31" },
  { id: "eth-etf", question: "ETH ETF approved by Q3 2026?", category: "Regulation", yesPct: 48, volume: "$2.1M", participants: 890, closes: "Sep 30" },
  { id: "fed-cut", question: "Will the Fed cut rates next meeting?", category: "Macro", yesPct: 71, volume: "$1.8M", participants: 2100, closes: "Jun 18" },
  { id: "sol-300", question: "SOL > $300 by August?", category: "Crypto", yesPct: 34, volume: "$980K", participants: 560, closes: "Aug 31" },
  { id: "ai-top10", question: "New AI token in the top 10 by Q4?", category: "AI", yesPct: 56, volume: "$640K", participants: 340, closes: "Oct 31" },
  { id: "btc-dominance", question: "BTC dominance stays above 60%?", category: "Crypto", yesPct: 41, volume: "$1.2M", participants: 780, closes: "Jul 15" },
  { id: "us-recession", question: "US recession confirmed in 2026?", category: "Macro", yesPct: 29, volume: "$2.4M", participants: 1560, closes: "Dec 31" },
  { id: "eth-flip", question: "Will Ethereum flip Bitcoin in market cap?", category: "Crypto", yesPct: 18, volume: "$890K", participants: 420, closes: "Dec 31" },
  { id: "apple-wallet", question: "Apple launches a crypto wallet by year-end?", category: "Tech", yesPct: 22, volume: "$540K", participants: 290, closes: "Dec 31" },
];

export const PREDICTION_CATEGORIES: (PredictionCategory | "All")[] = ["All", "Crypto", "Macro", "Regulation", "AI", "Tech"];

export const CATEGORY_BADGE_CLASS: Record<PredictionCategory, string> = {
  Crypto: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  Macro: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  Regulation: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  AI: "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
  Tech: "bg-green-500/15 text-green-400 border-green-500/20",
};

export type PredictionSide = "YES" | "NO";
export type PredictionOrderStatus = "Open" | "Won" | "Lost";

export type PredictionOrder = {
  id: string;
  marketId: string;
  question: string;
  side: PredictionSide;
  status: PredictionOrderStatus;
  placedAt: string; // display string
  priceCents: number; // price paid per share, in cents
  shares: number;
  cost: number; // BI2XUSD spent
};

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
  return side === "YES"
    ? "rounded bg-buy/15 px-2 py-0.5 text-[10px] font-bold text-buy"
    : "rounded bg-sell/15 px-2 py-0.5 text-[10px] font-bold text-sell";
}
