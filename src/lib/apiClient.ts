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
  return req<OrderResponse>(`/order?${params}`, { method: "POST" });
}

export function cancelOrder(symbol: string, market: string, orderId: string) {
  const params = new URLSearchParams({ symbol, market, order_id: orderId });
  return req<OrderResponse>(`/cancel?${params}`, { method: "POST" });
}
