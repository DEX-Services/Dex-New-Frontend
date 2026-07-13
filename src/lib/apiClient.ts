const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

export type DepthLevel = { price: string; size: string; total: string };
export type DepthResponse = { symbol: string; market: string; bids: DepthLevel[]; asks: DepthLevel[] };

export type TradeDTO = {
  id: string;
  symbol: string;
  market: string;
  price: string;
  quantity: string;
  side: "BUY" | "SELL";
  timestamp: number;
};
export type TradesResponse = { symbol: string; market: string; trades: TradeDTO[] };

export type OrderResponse = { orderId: string; status: string; filled: string; trades: number };

export type BalanceResponse = {
  account: string;
  asset: string;
  balance: string;
  reserved: string;
  available: string;
};

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export function getDepth(symbol: string, market: string, levels = 20) {
  const params = new URLSearchParams({ symbol, market, levels: String(levels) });
  return req<DepthResponse>(`/depth?${params}`);
}

export function getTrades(symbol: string, market: string, limit = 50) {
  const params = new URLSearchParams({ symbol, market, limit: String(limit) });
  return req<TradesResponse>(`/trades?${params}`);
}

export function getBalance(account: string, asset: string) {
  const params = new URLSearchParams({ account, asset });
  return req<BalanceResponse>(`/admin/balance?${params}`);
}

export type SubmitOrderParams = {
  account: string;
  symbol: string;
  market: string;
  side: "BUY" | "SELL";
  type?: "LIMIT" | "MARKET" | "IOC" | "FOK";
  price?: string;
  qty: string;
  // Futures-only.
  leverage?: number;
  marginMode?: "ISOLATED" | "CROSS";
  // Options-only.
  optionType?: "CALL" | "PUT";
  strike?: string;
  expiry?: string; // RFC3339
};

export function submitOrder(p: SubmitOrderParams) {
  const params = new URLSearchParams({
    account: p.account,
    symbol: p.symbol,
    market: p.market,
    side: p.side,
    type: p.type ?? "LIMIT",
    price: p.price ?? "0",
    qty: p.qty,
  });
  if (p.leverage !== undefined) params.set("leverage", String(p.leverage));
  if (p.marginMode) params.set("marginMode", p.marginMode);
  if (p.optionType) params.set("optionType", p.optionType);
  if (p.strike) params.set("strike", p.strike);
  if (p.expiry) params.set("expiry", p.expiry);
  return req<OrderResponse>(`/order?${params}`, { method: "POST" });
}

export function cancelOrder(symbol: string, market: string, orderId: string) {
  const params = new URLSearchParams({ symbol, market, order_id: orderId });
  return req<OrderResponse>(`/cancel?${params}`, { method: "POST" });
}

export type FuturesPositionDTO = {
  symbol: string;
  side: "BUY" | "SELL";
  size: string;
  entryPrice: string;
  markPrice: string;
  margin: string;
  leverage: number;
  unrealizedPnl: string;
};

export type OptionsPositionDTO = {
  symbol: string;
  optionType: "CALL" | "PUT";
  strikePrice: string;
  expiry: string;
  size: string;
  premium: string;
};

export type PositionsResponse = {
  futures: FuturesPositionDTO[];
  options: OptionsPositionDTO[];
};

export type OpenOrderDTO = {
  id: string;
  symbol: string;
  market: string;
  side: "BUY" | "SELL";
  price?: string;
  qty: string;
  filled: string;
  status: string;
};
export type OrdersResponse = { orders: OpenOrderDTO[] };

export function getOrders(account: string) {
  const params = new URLSearchParams({ account });
  return req<OrdersResponse>(`/orders?${params}`);
}

export function getPositions(account: string) {
  const params = new URLSearchParams({ account });
  return req<PositionsResponse>(`/positions?${params}`);
}

export type OptionChainEntry = {
  symbol: string;
  optionType: "CALL" | "PUT";
  strike: string;
  expiry: string;
  bid: string;
  ask: string;
  mid: string;
  iv: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
};

export type OptionChainResponse = {
  underlying: string;
  spot: string;
  chain: OptionChainEntry[];
};

export function getOptionChain(underlying: string) {
  const params = new URLSearchParams({ underlying });
  return req<OptionChainResponse>(`/option-chain?${params}`);
}
