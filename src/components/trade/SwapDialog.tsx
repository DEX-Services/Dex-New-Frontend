import { useState } from "react";
import {
  ArrowRight,
  ArrowUpDown,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { parseUnits } from "viem";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { swapAssets } from "@/lib/authApi";
import { wallet, useWallet } from "@/lib/useWallet";
import { cn } from "@/lib/utils";

type TokenSymbol = "USDC" | "USDT" | "USDB";

interface Token {
  symbol: TokenSymbol;
  name: string;
  color: string;
  textColor: string;
  icon: string;
}

// USDB is the platform's internal stable quote currency (pegged 1:1 to
// USDT, no on-chain contract of its own) — every market trades against it.
// This swap lets a user move deposit-intake USDC/USDT into tradable USDB
// manually; real on-chain deposits already convert automatically (see
// Dex-Backend's chain.Listener), this covers balances credited before that
// migration or credited directly as USDC/USDT.
const TOKENS: Record<TokenSymbol, Token> = {
  USDC: { symbol: "USDC", name: "USD Coin", color: "#2775CA", textColor: "#fff", icon: "$" },
  USDT: { symbol: "USDT", name: "Tether", color: "#26A17B", textColor: "#fff", icon: "₮" },
  USDB: { symbol: "USDB", name: "BitDx USD", color: "#7C5CFC", textColor: "#fff", icon: "B" },
};
const TOKEN_LIST = Object.values(TOKENS);

// Fixed 1:1 test rate, matching the backend's test-only /wallet/swap endpoint
// (swapTestPairs: any two of USDC/USDT/USDB). All three assets use 6
// decimals, so no conversion factor is needed between any pair.
const SWAP_DECIMALS = 6;

function TokenAvatar({ token, size = 32 }: { token: Token; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold"
      style={{
        background: token.color,
        boxShadow: `0 0 12px ${token.color}55`,
        color: token.textColor,
        fontSize: size * 0.44,
        height: size,
        width: size,
      }}
      aria-hidden="true"
    >
      {token.icon}
    </span>
  );
}

function TokenSelect({
  value, exclude, onChange,
}: {
  value: TokenSymbol;
  exclude: TokenSymbol;
  onChange: (symbol: TokenSymbol) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as TokenSymbol)}>
      <SelectTrigger className="h-12 min-w-[128px] rounded-xl border border-border bg-muted/30 px-3">
        <SelectValue asChild>
          <span className="flex items-center gap-2">
            <TokenAvatar token={TOKENS[value]} size={26} />
            <span className="font-bold">{value}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {TOKEN_LIST.filter((t) => t.symbol !== exclude).map((t) => (
          <SelectItem key={t.symbol} value={t.symbol}>
            <span className="flex items-center gap-2">
              <TokenAvatar token={t} size={20} />
              {t.symbol}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function formatAmount(value: number, maximumFractionDigits = 4) {
  return value.toLocaleString(undefined, {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  });
}

function amountForInput(value: number) {
  return value.toFixed(4).replace(/\.?0+$/, "");
}

function sanitizeAmount(value: string) {
  const cleaned = value.replace(/[^\d.]/g, "");
  const [whole = "", ...decimalParts] = cleaned.split(".");
  const decimal = decimalParts.join("").slice(0, SWAP_DECIMALS);
  return decimalParts.length > 0 ? `${whole}.${decimal}` : whole;
}

export function SwapDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const [fromSymbol, setFromSymbol] = useState<TokenSymbol>("USDC");
  const [toSymbol, setToSymbol] = useState<TokenSymbol>("USDB");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { balances } = useWallet();

  const fromToken = TOKENS[fromSymbol];
  const toToken = TOKENS[toSymbol];
  const numericAmount = Number.parseFloat(amount) || 0;
  // Fixed 1:1 test rate.
  const outputAmount = numericAmount;
  const fromBalance = balances.find((b) => b.asset === fromToken.symbol)?.available ?? 0;
  const insufficient = numericAmount > fromBalance;
  const canSwap = numericAmount > 0 && !insufficient && !submitting;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setAmount("");
    onOpenChange(nextOpen);
  };

  // Picking a "From" token that collides with the current "To" bumps "To" to
  // whichever token isn't now selected on either side, and vice versa —
  // three tokens total means there's always exactly one other candidate.
  const otherOf = (a: TokenSymbol, b: TokenSymbol) =>
    TOKEN_LIST.map((t) => t.symbol).find((s) => s !== a && s !== b)!;

  const handleFromChange = (symbol: TokenSymbol) => {
    setFromSymbol(symbol);
    if (symbol === toSymbol) setToSymbol(otherOf(symbol, fromSymbol));
  };
  const handleToChange = (symbol: TokenSymbol) => {
    setToSymbol(symbol);
    if (symbol === fromSymbol) setFromSymbol(otherOf(symbol, toSymbol));
  };

  const handleDirectionChange = () => {
    setFromSymbol(toSymbol);
    setToSymbol(fromSymbol);
    setAmount(outputAmount > 0 ? amountForInput(outputAmount) : "");
  };

  const handleMax = () => {
    setAmount(amountForInput(fromBalance));
  };

  const handleSwap = async () => {
    if (numericAmount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (insufficient) {
      toast.error(`Insufficient ${fromToken.symbol} balance`);
      return;
    }

    setSubmitting(true);
    try {
      const amountRaw = parseUnits(amount, SWAP_DECIMALS).toString();
      await swapAssets(fromToken.symbol, toToken.symbol, amountRaw);
      await wallet.refreshBalances();
      toast.success("Swap completed", {
        description: `${formatAmount(numericAmount)} ${fromToken.symbol} to ${formatAmount(outputAmount)} ${toToken.symbol}`,
      });
      handleOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Swap failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[calc(100%_-_2rem)] max-w-[526px] gap-0 overflow-visible rounded-2xl border-glass-border bg-background/95 p-0 shadow-2xl backdrop-blur-2xl [&>button]:right-6 [&>button]:top-6">
        <DialogHeader className="border-b border-border px-6 py-5 pr-14">
          <DialogTitle className="flex items-center gap-2.5 text-xl">
            <ArrowUpDown className="h-5 w-5 text-primary" />
            Swap
          </DialogTitle>
          <DialogDescription className="sr-only">
            Swap between USDC, USDT, and USDB at a fixed 1:1 test rate.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-5">
          <section
            className={cn(
              "rounded-2xl border bg-muted/10 p-5 transition-colors",
              insufficient ? "border-sell/60 bg-sell/5" : "border-border",
            )}
          >
            <div className="mb-3 flex items-center justify-between gap-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                From
              </span>
              <button
                type="button"
                onClick={handleMax}
                className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Use full balance of ${formatAmount(fromBalance)} ${fromToken.symbol}`}
              >
                <span className="truncate">
                  Available: <span className="font-mono">{formatAmount(fromBalance)} {fromToken.symbol}</span>
                </span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <TokenSelect value={fromSymbol} exclude={toSymbol} onChange={handleFromChange} />
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0"
                  value={amount}
                  onChange={(event) => setAmount(sanitizeAmount(event.target.value))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && canSwap) handleSwap();
                  }}
                  className={cn(
                    "min-w-0 flex-1 bg-transparent text-right font-mono text-2xl font-bold outline-none placeholder:text-muted-foreground/40",
                    insufficient ? "text-sell" : "text-foreground",
                  )}
                  aria-label={`Amount of ${fromToken.symbol} to swap`}
                />
                <button
                  type="button"
                  onClick={handleMax}
                  className="shrink-0 px-1 text-xs font-semibold text-primary transition-colors hover:text-primary/80"
                >
                  All
                </button>
              </div>
            </div>

            {insufficient && (
              <p className="mt-3 text-xs text-sell">
                Amount exceeds your available {fromToken.symbol} balance.
              </p>
            )}
          </section>

          <div className="-my-1 flex justify-center">
            <button
              type="button"
              onClick={handleDirectionChange}
              className="group flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-warning to-amber-500 shadow-[0_0_20px_hsl(40_100%_60%/0.45)] transition-all hover:scale-105 hover:shadow-[0_0_28px_hsl(40_100%_60%/0.65)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning"
              title="Reverse swap direction"
              aria-label="Reverse swap direction"
            >
              <ArrowUpDown className="h-5 w-5 text-zinc-900 transition-transform duration-300 group-hover:rotate-180" />
            </button>
          </div>

          <section className="rounded-2xl border border-border bg-muted/10 p-5">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              To
            </div>
            <div className="flex items-center gap-3">
              <TokenSelect value={toSymbol} exclude={fromSymbol} onChange={handleToChange} />
              <div className="min-w-0 flex-1 truncate text-right font-mono text-2xl font-bold">
                <span className={outputAmount > 0 ? "text-foreground" : "text-muted-foreground/40"}>
                  {outputAmount > 0 ? formatAmount(outputAmount) : "0"}
                </span>
              </div>
            </div>
          </section>

          {numericAmount > 0 && (
            <div className="text-center font-mono text-[11px] text-muted-foreground">
              1 {fromToken.symbol} ≈ 1.0000 {toToken.symbol} (fixed test rate)
            </div>
          )}

          <div className="space-y-3 rounded-xl border border-border bg-muted/20 px-4 py-3.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Transaction Fees</span>
              <span className="rounded-full bg-buy/15 px-2.5 py-1 text-xs font-semibold text-buy">
                0 Fee
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted-foreground">You get</span>
              <span className="truncate font-mono font-bold">
                {outputAmount > 0 ? `${formatAmount(outputAmount)} ${toToken.symbol}` : "-"}
              </span>
            </div>
          </div>

          <Button
            type="button"
            onClick={handleSwap}
            disabled={!canSwap}
            className="h-14 w-full rounded-2xl bg-primary text-base font-bold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {!numericAmount ? (
              "Enter Amount"
            ) : insufficient ? (
              "Insufficient Balance"
            ) : submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Swapping...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Swap {fromToken.symbol}
                <ArrowRight className="h-4 w-4" />
                {toToken.symbol}
              </span>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
