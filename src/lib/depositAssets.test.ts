import { describe, it, expect } from "vitest";
import { DEPOSIT_ALLOWLIST, DEPOSIT_ASSETS, chainsFor, isDepositAllowed, isChainLive } from "./depositAssets";

describe("depositAssets allowlist", () => {
  it("restricts BIUSDB and BI2X to Avalanche only", () => {
    expect(chainsFor("BIUSDB")).toEqual(["AVAX"]);
    expect(chainsFor("BI2X")).toEqual(["AVAX"]);
  });

  it("allows USDT and USDC across all seven chains", () => {
    const expected = ["BEP20", "ERC20", "AVAX", "TON", "TRC20", "Polygon", "Arbitrum"];
    expect(chainsFor("USDT")).toEqual(expected);
    expect(chainsFor("USDC")).toEqual(expected);
  });

  it("returns no chains for an unknown asset", () => {
    expect(chainsFor("ETH")).toEqual([]);
  });

  it("isDepositAllowed matches the allowlist exactly", () => {
    expect(isDepositAllowed("BIUSDB", "AVAX")).toBe(true);
    expect(isDepositAllowed("BIUSDB", "ERC20")).toBe(false);
    expect(isDepositAllowed("BI2X", "TRC20")).toBe(false);
    expect(isDepositAllowed("USDT", "TON")).toBe(true);
    expect(isDepositAllowed("USDC", "Polygon")).toBe(true);
    expect(isDepositAllowed("ETH", "AVAX")).toBe(false);
  });

  it("only AVAX is live today; every other allowed chain is not yet wired up", () => {
    expect(isChainLive("AVAX")).toBe(true);
    for (const chain of ["BEP20", "ERC20", "TON", "TRC20", "Polygon", "Arbitrum"]) {
      expect(isChainLive(chain)).toBe(false);
    }
  });

  it("exposes exactly the four allowed deposit assets", () => {
    expect(DEPOSIT_ASSETS.sort()).toEqual(["BI2X", "BIUSDB", "USDC", "USDT"].sort());
    expect(Object.keys(DEPOSIT_ALLOWLIST).sort()).toEqual(DEPOSIT_ASSETS.sort());
  });
});
