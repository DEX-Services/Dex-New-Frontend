import { authHeader, clearSession } from "./Auth";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

/**
 * ApiError carries the HTTP status alongside the message so callers (and the
 * UI) can react to *why* a request failed instead of treating every failure as
 * an opaque string. Previously every non-2xx response became a bare Error, so a
 * 401 (session expired), a 429 (rate limited), a 400 (engine rejected the order
 * — bad price/insufficient balance) and a 503 (engine down) were all
 * indistinguishable, and the app could not, e.g., log the user out on expiry or
 * back off on a rate limit.
 */
export class ApiError extends Error {
  status: number;
  /** True for transient failures where a retry may succeed (5xx / network). */
  retryable: boolean;
  /** True when the server rejected auth (expired/invalid session). */
  isAuthError: boolean;
  /** True when rate-limited (HTTP 429). */
  isRateLimited: boolean;
  /** Seconds the server asked us to wait before retrying (from Retry-After). */
  retryAfter?: number;

  constructor(status: number, message: string, retryAfter?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    // status === 0 is our sentinel for "the fetch itself threw" (offline / DNS /
    // CORS), which is always worth retrying.
    this.retryable = status === 0 || status >= 500;
    this.isAuthError = status === 401 || status === 403;
    this.isRateLimited = status === 429;
    this.retryAfter = retryAfter;
  }
}

/** Registered callback invoked once whenever a request fails auth (401/403). */
let onAuthExpired: (() => void) | null = null;
export function setAuthExpiredHandler(fn: (() => void) | null) {
  onAuthExpired = fn;
}

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

function parseRetryAfter(res: Response): number | undefined {
  const h = res.headers.get("Retry-After");
  if (!h) return undefined;
  const secs = Number(h);
  return Number.isFinite(secs) ? secs : undefined;
}

async function doFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...opts,
      headers: { ...authHeader(), ...(opts?.headers ?? {}) },
    });
  } catch (e) {
    // Network-level failure (offline, DNS, CORS): surface as retryable status 0.
    throw new ApiError(0, e instanceof Error ? e.message : "network error");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const message = text || `${res.status} ${res.statusText}`;
    const err = new ApiError(res.status, message, parseRetryAfter(res));
    if (err.isAuthError) {
      // Session expired or was revoked server-side: drop the stale token and
      // let the app react (redirect to login) exactly once.
      clearSession();
      onAuthExpired?.();
    }
    throw err;
  }
  // 204/empty bodies: don't blow up trying to JSON-parse nothing.
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/**
 * req wraps doFetch with a small bounded retry for transient failures (5xx and
 * network errors) using exponential backoff, honoring Retry-After on 429. Auth
 * errors and 4xx (client/engine rejections) are NOT retried — they won't
 * succeed on retry and doing so would, e.g., re-submit a rejected order.
 */
async function req<T>(path: string, opts?: RequestInit, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await doFetch<T>(path, opts);
    } catch (e) {
      lastErr = e;
      if (!(e instanceof ApiError)) throw e;
      const isLast = i === attempts - 1;
      if (e.isRateLimited) {
        if (isLast) throw e;
        await sleep((e.retryAfter ?? 1) * 1000);
        continue;
      }
      if (e.retryable && !isLast) {
        await sleep(Math.min(2 ** i * 250, 2000));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
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
  // Non-idempotent: a retry could place a second order. attempts=1.
  return req<OrderResponse>(`/order?${params}`, { method: "POST" }, 1);
}

export function cancelOrder(symbol: string, market: string, orderId: string) {
  const params = new URLSearchParams({ symbol, market, order_id: orderId });
  // Non-idempotent from the caller's perspective; don't auto-retry.
  return req<OrderResponse>(`/cancel?${params}`, { method: "POST" }, 1);
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
