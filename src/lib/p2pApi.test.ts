import { describe, expect, it } from "vitest";
import { formatUSDBAmount, parseUSDBAmount } from "./p2pApi";

describe("USDB P2P amount formatting", () => {
  it.each([
    ["5000000", "5.00"],
    ["5500000", "5.50"],
    ["10250000", "10.25"],
    ["100000000", "100.00"],
  ])("formats %s raw as %s USDB", (raw, formatted) => {
    expect(formatUSDBAmount(raw)).toBe(formatted);
  });

  it("parses a displayed two-decimal amount into raw USDB", () => {
    expect(parseUSDBAmount("10.25")).toBe("10250000");
  });
});
