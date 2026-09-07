import { describe, expect, it } from "vitest";
import { effectiveP2PMaxOrderFiat, formatUSDBAmount, formatUSDBSellCapacity, grossUSDBAmountForNet, netUSDBAmountAfterBuyerFee, parseUSDBAmount, usdbAmountFromFiat } from "./p2pApi";

describe("USDB P2P amount formatting", () => {
  it.each([
    ["5000000", "5"],
    ["5500000", "5.5"],
    ["10250000", "10.25"],
    ["100000001", "100.000001"],
  ])("formats %s raw as %s USDB", (raw, formatted) => {
    expect(formatUSDBAmount(raw)).toBe(formatted);
  });

  it("parses a USDB amount with up to six decimal places", () => {
    expect(parseUSDBAmount("10.25")).toBe("10250000");
    expect(parseUSDBAmount("10.123456")).toBe("10123456");
  });

  it("shows only the amount that can be listed after the seller fee", () => {
    expect(formatUSDBSellCapacity("10100000")).toBe("10");
    expect(formatUSDBSellCapacity("10000000")).toBe("9.900991");
  });

  it("reduces the effective upper limit when an ad has less value remaining", () => {
    expect(effectiveP2PMaxOrderFiat({ maxOrderFiat: "300.00", remainingRaw: "2000000", price: "100.00" })).toBe(200);
    expect(effectiveP2PMaxOrderFiat({ maxOrderFiat: "300.00", remainingRaw: "5000000", price: "100.00" })).toBe(300);
  });

  it("converts an INR investment into a six-decimal USDB quantity without overspending", () => {
    expect(usdbAmountFromFiat("250.00", "100.00")).toBe("2.5");
    expect(usdbAmountFromFiat("100.00", "99.00")).toBe("1.010101");
  });

  it("calculates the gross quantity needed for a desired net USDB receipt", () => {
    expect(grossUSDBAmountForNet("1.00")).toBe("1.010101");
    expect(grossUSDBAmountForNet("4.95")).toBe("4.999999");
    expect(netUSDBAmountAfterBuyerFee("3.50")).toBe("3.465");
  });
});
