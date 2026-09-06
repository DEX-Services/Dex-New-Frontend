import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import P2P from "./P2P";

describe("P2P page", () => {
  let listings: object[];

  beforeEach(() => {
    listings = [];
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes("/p2p/price")
        ? { price: { asset: "USDB", fiatCurrency: "INR", price: "100.00000000", priceDate: "2026-07-16", createdAt: new Date().toISOString() } }
        : { listings };
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));
    }));
  });

  it("renders the USDB marketplace without a Post Ad action", async () => {
    render(<MemoryRouter><P2P /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Buy USDB" })).toBeInTheDocument();
    expect(await screen.findByText("No matching USDB ads found.")).toBeInTheDocument();
    expect(screen.getByText(/Database price for/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Post Ad/i })).not.toBeInTheDocument();
  });

  it("links the buyer's INR payment and net USDB receipt fields", async () => {
    listings = [{
      id: "listing-1", creatorId: "seller-1", username: "SellerOne", side: "SELL", asset: "USDB",
      amountRaw: "5000000", remainingRaw: "5000000", price: "100.00", fiatCurrency: "INR",
      minOrderFiat: "100.00", maxOrderFiat: "350.00", paymentMethods: ["UPI"], status: "ACTIVE",
      completedOrders: 0, completedAmountRaw: "0", completedOrders30d: 0, completionRate30d: "0.00",
      ratedOrders30d: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }];
    render(<MemoryRouter><P2P /></MemoryRouter>);
    expect(await screen.findByText("SellerOne")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "BUY USDB" }).at(-1)!);

    const payInput=screen.getByRole("textbox", { name: "You pay in INR" }) as HTMLInputElement;
    const receiveInput=screen.getByRole("textbox", { name: "You receive in USDB" }) as HTMLInputElement;
    expect(payInput.value).toBe("100.00");
    expect(receiveInput.value).toBe("0.99");

    fireEvent.change(receiveInput,{target:{value:"1.00"}});
    expect(payInput.value).toBe("101.00");
    fireEvent.change(payInput,{target:{value:"250.00"}});
    expect(receiveInput.value).toBe("2.48");
  });
});
