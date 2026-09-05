import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PostAdsDialog } from "./PostAdsDialog";

describe("PostAdsDialog USDB amount", () => {
  it("rejects digits beyond two decimal places", () => {
    render(
      <PostAdsDialog
        open
        onOpenChange={vi.fn()}
        side="SELL"
        username="rohit"
        onUsernameEstablished={vi.fn()}
        onCreated={vi.fn()}
      />,
    );

    const amount = screen.getByRole("textbox");
    fireEvent.change(amount, { target: { value: "20.00" } });
    fireEvent.change(amount, { target: { value: "20.000" } });
    expect(amount).toHaveValue("20.00");
  });
});
