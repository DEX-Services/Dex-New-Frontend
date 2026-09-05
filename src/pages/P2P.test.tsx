import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import P2P from "./P2P";

describe("P2P page", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes("/p2p/price")
        ? { price: { asset: "USDB", fiatCurrency: "INR", price: "100.00000000", priceDate: "2026-07-16", createdAt: new Date().toISOString() } }
        : { listings: [] };
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
});
