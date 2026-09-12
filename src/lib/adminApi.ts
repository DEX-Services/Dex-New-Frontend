import { authHeader, setSession, updateSessionUser, type SessionUser } from "@/lib/Auth";
import type { P2POrder, P2POrderEvent, P2POrderMessage, P2POrderProof } from "@/lib/p2pApi";

const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL ?? "http://localhost:8081";

async function adminReq<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${AUTH_API_URL}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
      ...(opts?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

/** A market the matching engine is currently refusing orders on. A settlement
 *  failure halts a symbol for every account trading it, so this is an outage,
 *  not a per-user problem. */
export type HaltedSymbol = {
  symbol: string;
  market: string;
  reason: string;
  note: string;
};

export function listHaltedSymbols() {
  return adminReq<{ halted: HaltedSymbol[] }>("/admin/halted");
}

export function resumeSymbol(symbol: string, market: string) {
  return adminReq<{ symbol: string; market: string; status: string }>("/admin/resume", {
    method: "POST",
    body: JSON.stringify({ symbol, market }),
  });
}

export type AdminTokenTotal = {
  token: string;
  amount: string;
  locked: string;
};

export type AdminTopUser = {
  userId: string;
  walletAddress: string;
  walletType: string;
  entryCount: number;
  totalRaw: string;
  lastLoginAt?: string;
};

export type AdminLedgerEntry = {
  id: string;
  userId: string;
  walletAddress: string;
  kind: string;
  token: string;
  amount: string;
  status: string;
  createdAt: string;
};

export type AdminRecentUser = {
  id: string;
  walletAddress: string;
  walletType: string;
  createdAt: string;
  lastLoginAt?: string;
};

export type AdminSummary = {
  totalUsers: number;
  activeUsers24h: number;
  openSessions: number;
  totalLedgerEntries: number;
  confirmedLedgerRaw: string;
  pendingWithdrawals: number;
  p2pFeeWalletRaw: string;
  totalBalances: AdminTokenTotal[];
  topUsers: AdminTopUser[];
  recentLedgerEntries: AdminLedgerEntry[];
  recentUsers: AdminRecentUser[];
};

export async function adminLogin(loginId: string, password: string) {
  const result = await adminReq<{ token: string; user: SessionUser }>("/admin/login", {
    method: "POST",
    body: JSON.stringify({ loginId, password }),
  });
  setSession(result);
  return result;
}

export function getAdminDashboard() {
  return adminReq<AdminSummary>("/admin/dashboard");
}

export const getAdminP2PAppeals=()=>adminReq<{orders:P2POrder[]}>("/admin/p2p/appeals");
export const getAdminP2PAppealDetail=(orderId:string)=>adminReq<{proofs:P2POrderProof[];messages:P2POrderMessage[];events:P2POrderEvent[]}>(`/admin/p2p/appeals?orderId=${encodeURIComponent(orderId)}`);
export const resolveAdminP2PAppeal=(orderId:string,resolution:"RELEASE"|"REFUND")=>adminReq<{order:P2POrder}>("/admin/p2p/appeals",{method:"POST",body:JSON.stringify({orderId,resolution})});
export async function openAdminP2PProof(proofId:string){const response=await fetch(`${AUTH_API_URL}/admin/p2p/proofs/download?proofId=${encodeURIComponent(proofId)}`,{headers:authHeader()});if(!response.ok)throw new Error("Could not load payment proof");const url=URL.createObjectURL(await response.blob());window.open(url,"_blank","noopener,noreferrer");window.setTimeout(()=>URL.revokeObjectURL(url),60_000)}

export function getAdminProfile() {
  return adminReq<SessionUser>("/admin/profile");
}

export async function updateAdminProfile(profile: Pick<SessionUser, "name" | "email" | "phone">) {
  const updated = await adminReq<SessionUser>("/admin/profile", {
    method: "PUT",
    body: JSON.stringify(profile),
  });
  updateSessionUser(updated);
  return updated;
}

export type AdminUser = {
  id: string;
  walletAddress: string;
  walletType: string;
  createdAt: string;
  lastLoginAt?: string;
};

export function searchAdminUsers(q: string, limit = 20) {
  const params = new URLSearchParams({ q, limit: String(limit) });
  return adminReq<{ users: AdminUser[] }>(`/admin/users/search?${params}`);
}

export type AdjustBalanceDirection = "credit" | "debit";

export type AdjustBalanceResult = {
  userId: string;
  balances: Record<string, string>;
};

// DEV/TESTING ONLY: manually credits or debits a user's balance for one
// asset, outside any real deposit or trade. See AdminServer.AdjustUserBalance.
export function adjustUserBalance(
  userId: string,
  asset: string,
  amount: string,
  direction: AdjustBalanceDirection,
) {
  return adminReq<AdjustBalanceResult>("/admin/users/balance", {
    method: "POST",
    body: JSON.stringify({ userId, asset, amount, direction }),
  });
}

// Fee config: the platform's base fee rates (spot/futures maker+taker, P2P,
// swap, liquidation) — see FEE-TIER-SYSTEM-PLAN.md. Keys match
// feeconfig.ValidKeys() on the backend exactly.
export const FEE_CONFIG_KEYS = [
  "spot.maker",
  "spot.taker",
  "futures.maker",
  "futures.taker",
  "p2p.buyer",
  "p2p.seller",
  "swap.in",
  "swap.out",
  "liquidation",
] as const;
export type FeeConfigKey = (typeof FEE_CONFIG_KEYS)[number];

export function getAdminFeeRates() {
  return adminReq<{ rates: Record<string, string> }>("/admin/fees");
}

// Rejected by the backend outside [0, 0.05] for ordinary fees and
// [0, 0.10] for "liquidation" (see feeconfig.RateBounds) — the UI should
// mirror that bound so a mistaken edit is caught before the request round
// trip, not just after.
export function setAdminFeeRate(key: FeeConfigKey, rate: string) {
  return adminReq<{ status: string; key: string; rate: string }>("/admin/fees/set", {
    method: "POST",
    body: JSON.stringify({ key, rate }),
  });
}

export type AdminFeeSubscription = {
  ID: number;
  UserID: string;
  Tier: number;
  DiscountPct: string;
  BI2XPriceSnapshot: string;
  BI2XAmountPaid: string;
  PurchasedAt: string;
  ExpiresAt: string;
  Status: string;
};

export function getAdminFeeSubscriptions(userId: string) {
  const params = new URLSearchParams({ user: userId });
  return adminReq<{ subscriptions: AdminFeeSubscription[] | null }>(`/admin/fees/subscriptions?${params}`);
}
