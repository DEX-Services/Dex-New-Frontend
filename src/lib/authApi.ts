const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL ?? "http://localhost:8081";

export type AuthUser = {
  id: string;
  walletAddress: string;
  walletType: string;
  createdAt: string;
  lastLoginAt?: string;
};

async function authReq<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${AUTH_API_URL}${path}`, { ...opts, credentials: "include" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export function getNonce(address: string) {
  const params = new URLSearchParams({ address });
  return authReq<{ nonce: string; message: string }>(`/auth/nonce?${params}`);
}

export function login(address: string, signature: string, walletType: string) {
  return authReq<{ user: AuthUser; token: string }>(`/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, signature, walletType }),
  });
}

export function logout() {
  return authReq<{ status: string }>(`/auth/logout`, { method: "POST" });
}

export function me() {
  return authReq<{ user: AuthUser }>(`/auth/me`);
}
