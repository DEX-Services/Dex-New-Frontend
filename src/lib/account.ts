import { useWallet } from "@/lib/useWallet";

// Fallback account used for order placement when no wallet is connected
// (anonymous/demo browsing).
export const DEMO_ACCOUNT = "buyer";

// Resolves the account to use for order placement: the real logged-in
// user's Dex-Backend user ID when connected, otherwise the demo account.
export function useAccount(): string {
  const { connected, userId } = useWallet();
  return connected && userId ? userId : DEMO_ACCOUNT;
}
