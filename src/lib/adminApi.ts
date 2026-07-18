import { authHeader, setSession, updateSessionUser, type SessionUser } from "@/lib/Auth";
import type { P2POrder } from "@/lib/p2pApi";

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
  totalBalances: AdminTokenTotal[];
  topUsers: AdminTopUser[];
  recentLedgerEntries: AdminLedgerEntry[];
  recentUsers: AdminRecentUser[];
};

export type AdminP2PPrice = {
  asset: string;
  fiatCurrency: string;
  price: string;
  priceDate: string;
  createdAt: string;
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

export function getAdminP2PPrice() {
  return adminReq<{ price: AdminP2PPrice }>("/admin/p2p/price");
}

export function setAdminP2PPrice(price: string) {
  return adminReq<{ price: AdminP2PPrice }>("/admin/p2p/price", {
    method: "PUT",
    body: JSON.stringify({ price }),
  });
}

export function getAdminP2PAppeals() {
  return adminReq<{ orders: P2POrder[] }>("/admin/p2p/appeals");
}

export function resolveAdminP2PAppeal(orderId: string, action: "release"|"cancel") {
  return adminReq<{ order: P2POrder }>("/admin/p2p/appeals/resolve", {
    method: "POST",
    body: JSON.stringify({ orderId, action }),
  });
}

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
