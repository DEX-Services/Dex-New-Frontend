// The platform's deposit allowlist: which (asset, chain) combinations are
// permitted at all. This is a product/compliance restriction, independent of
// which chains actually have a working on-chain listener today (only
// Avalanche has one — see Dex-Backend's internal/chain.Listener) — the
// allowlist says what's ALLOWED to be offered; TransferDialog additionally
// checks isChainLive() before letting a deposit actually submit.
//
// - BIUSDB and BI2X: Avalanche only. Both are the platform's own assets with
//   no independent existence on any other chain (BIUSDB is pegged 1:1 to
//   USDT internally; BI2X only trades on this exchange) — allowing them on
//   BEP20/ERC20/etc. would create a token that doesn't actually exist there.
// - USDT and USDC: real, widely-bridged stablecoins, allowed across the
//   chains they actually circulate on.
export type Chain = "BEP20" | "ERC20" | "AVAX" | "TON" | "TRC20" | "Polygon" | "Arbitrum";
export type DepositAsset = "USDT" | "USDC" | "BIUSDB" | "BI2X";

export const ALL_CHAINS: Chain[] = ["BEP20", "ERC20", "AVAX", "TON", "TRC20", "Polygon", "Arbitrum"];

export const DEPOSIT_ALLOWLIST: Record<DepositAsset, Chain[]> = {
  BIUSDB: ["AVAX"],
  BI2X: ["AVAX"],
  USDT: ["BEP20", "ERC20", "AVAX", "TON", "TRC20", "Polygon", "Arbitrum"],
  USDC: ["BEP20", "ERC20", "AVAX", "TON", "TRC20", "Polygon", "Arbitrum"],
};

export const DEPOSIT_ASSETS = Object.keys(DEPOSIT_ALLOWLIST) as DepositAsset[];

export function chainsFor(asset: string): Chain[] {
  return DEPOSIT_ALLOWLIST[asset as DepositAsset] ?? [];
}

export function isDepositAllowed(asset: string, chain: string): boolean {
  return chainsFor(asset).includes(chain as Chain);
}

// isChainLive: of the allowed combinations above, which ones this build can
// actually submit a real on-chain deposit for right now. Only Avalanche has
// a working chain.Listener + deployed DexVault contract (see Dex-Backend's
// internal/chain package) — every other chain in DEPOSIT_ALLOWLIST is a
// real, permitted combination the product intends to support, but isn't
// wired up to an actual contract/listener yet. Keeping this separate from
// the allowlist means enabling a new chain later is turning this flag on,
// not re-deciding which combinations are allowed.
export function isChainLive(chain: string): boolean {
  return chain === "AVAX";
}
