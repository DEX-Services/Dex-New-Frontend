import { AppShell } from "@/components/AppShell";
import { Link } from "react-router-dom";
import { useMarkets } from "@/lib/useMarkets";
import { formatPrice } from "@/lib/mockData";
import { Wallet, PieChart, ArrowDownToLine, ArrowUpFromLine, History, DollarSign, BarChart3, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMemo, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { TransferDialog } from "@/components/wallet/TransferDialog";
import { wallet, useWallet } from "@/lib/useWallet";
import { useAccount } from "@/lib/account";
import { getPositions, getPnlHistory, FuturesPositionDTO, RealizedPnlDTO } from "@/lib/apiClient";
import { frontendSymbolFor } from "@/lib/backendMarkets";
import { resolveMarkPrice } from "@/components/trade/PositionsPanel";
import { useFuturesTickers } from "@/lib/useFuturesTickers";
import { wsClient, WSEvent } from "@/lib/wsClient";

// Fixed palette cycled by index — enough distinct hues that a real holding
// list (however many assets it turns out to have) never repeats a color
// for a visually different segment of the breakdown bar.
const BREAKDOWN_COLORS = [
  "hsl(145 65% 52%)", "hsl(38 90% 55%)", "hsl(225 70% 65%)", "hsl(280 80% 65%)",
  "hsl(178 70% 50%)", "hsl(0 70% 60%)", "hsl(48 90% 55%)", "hsl(260 60% 60%)",
];

const Portfolio = () => {
  const markets = useMarkets();
  const walletState = useWallet();
  const account = useAccount();
  const futuresTickers = useFuturesTickers();
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferMode, setTransferMode] = useState<"deposit" | "withdraw">("deposit");
  const [futuresPositions, setFuturesPositions] = useState<FuturesPositionDTO[]>([]);
  const [realizedPnl, setRealizedPnl] = useState<RealizedPnlDTO[]>([]);

  const openTransfer = (m: "deposit" | "withdraw") => { setTransferMode(m); setTransferOpen(true); };

  // Real realized-PnL event log (same endpoint the dedicated PnL page uses)
  // — this is what the Equity Curve and Win Rate/Avg Trade stats below are
  // built from, replacing what used to be a Math.random() walk and two
  // permanently-blank "—" stats. One page's worth (most recent 200) is
  // plenty for a summary chart; the full paginated log already has its own
  // page (PnL.tsx) for anyone who wants to dig through every entry.
  useEffect(() => {
    if (!account) {
      setRealizedPnl([]);
      return;
    }
    let cancelled = false;
    getPnlHistory({ limit: 200 })
      .then((r) => { if (!cancelled) setRealizedPnl(r.entries ?? []); })
      .catch(() => { if (!cancelled) setRealizedPnl([]); });
    return () => { cancelled = true; };
  }, [account]);

  // Real open futures positions (moved here from the trade page's Positions
  // panel, which still shows the same data while you're actively trading a
  // symbol — this is the account-wide view). Same fetch-then-poll-then-WS
  // pattern as PositionsPanel.tsx: an initial load, a 5s safety-net poll,
  // and a throttled refetch on this account's own fills so a position
  // updates within about a second of a fill instead of waiting for the poll.
  useEffect(() => {
    if (!account) {
      setFuturesPositions([]);
      return;
    }
    let cancelled = false;
    const fetchPositions = () => {
      getPositions(account)
        .then((res) => { if (!cancelled) setFuturesPositions(res.futures ?? []); })
        .catch(() => { if (!cancelled) setFuturesPositions([]); });
    };
    fetchPositions();
    const interval = setInterval(fetchPositions, 5000);
    let refetchTimer: ReturnType<typeof setTimeout> | null = null;
    let refetchPending = false;
    const throttledRefetch = () => {
      if (refetchTimer) {
        refetchPending = true;
        return;
      }
      fetchPositions();
      refetchTimer = setTimeout(() => {
        refetchTimer = null;
        if (refetchPending) {
          refetchPending = false;
          throttledRefetch();
        }
      }, 750);
    };
    const unsubWs = wsClient.subscribe((evt: WSEvent) => {
      const ownFill =
        (evt.type === "ORDER_FILLED" || evt.type === "ORDER_PARTIALLY_FILLED") &&
        evt.market === "FUTURES" &&
        (!evt.order?.accountId || evt.order.accountId === account);
      if (ownFill) throttledRefetch();
    });
    return () => {
      cancelled = true;
      clearInterval(interval);
      if (refetchTimer) clearTimeout(refetchTimer);
      unsubWs();
    };
  }, [account]);

  const positions = useMemo(() => futuresPositions.map(p => {
    const size = parseFloat(p.size);
    const entry = parseFloat(p.entryPrice);
    const displaySymbol = frontendSymbolFor(p.symbol, "FUTURES");
    const ticker = futuresTickers[p.symbol];
    const mockMarketPrice = markets.find(mk => mk.symbol === displaySymbol)?.price;
    const mark = resolveMarkPrice(ticker?.markPrice, p.markPrice, mockMarketPrice);
    const side = p.side === "BUY" ? "long" as const : "short" as const;
    const leverage = p.leverage || 1;
    const dir = side === "long" ? 1 : -1;
    const pnl = (mark - entry) * size * dir;
    const pnlPct = entry !== 0 ? ((mark - entry) / entry) * 100 * dir * leverage : 0;
    const value = mark * size;
    return { symbol: displaySymbol, side, size, entry, mark, leverage, pnl, pnlPct, value };
  }), [futuresPositions, markets, futuresTickers]);

  // Real spot holdings — every non-zero asset balance, valued at the
  // corresponding SPOT market's current price (BI2XUSD itself is cash, not
  // a "holding" with a market to price it against).
  const spotHoldings = useMemo(() => {
    return walletState.balances
      .filter((b) => b.asset !== "BI2XUSD" && b.amount > 0)
      .map((b) => {
        const displaySymbol = `${b.asset}-BI2XUSD`;
        const price = markets.find((mk) => mk.symbol === displaySymbol)?.price ?? 0;
        return { ...b, price, value: b.amount * price };
      });
  }, [walletState.balances, markets]);

  const totalPnl = positions.reduce((s, p) => s + p.pnl, 0);

  // Real equity curve: cumulative realized PnL over time (oldest first —
  // getPnlHistory returns newest first), with current unrealized PnL
  // appended as the live final point. This is a REALIZED-PnL curve, not a
  // full account-value-over-time curve — the backend has no balance-
  // snapshot history to build that from — but it's genuine trade outcomes,
  // not fabricated data. Empty when the account has no closed trades yet.
  const equityPoints = useMemo(() => {
    const chronological = [...realizedPnl].reverse();
    let running = 0;
    const points = chronological.map((p) => (running += parseFloat(p.pnl) || 0));
    points.push(running + totalPnl);
    return points;
  }, [realizedPnl, totalPnl]);

  // Real Win Rate / Avg Trade from the same realized-PnL log the dedicated
  // PnL page uses — these used to be permanently "—" placeholders.
  const tradeStats = useMemo(() => {
    const pnls = realizedPnl.map((p) => parseFloat(p.pnl) || 0);
    const wins = pnls.filter((n) => n > 0).length;
    const losses = pnls.filter((n) => n < 0).length;
    const winRate = wins + losses ? (wins / (wins + losses)) * 100 : null;
    const avgTrade = pnls.length ? pnls.reduce((s, n) => s + n, 0) / pnls.length : null;
    return { winRate, avgTrade, closedCount: pnls.length };
  }, [realizedPnl]);

  // Real asset breakdown: every priced holding across Spot (spotHoldings)
  // and open Futures notional (positions), replacing the old hardcoded
  // ASSET_BREAKDOWN mock list. A futures position's "value" here is its
  // notional (mark * size), same figure the Open table used to show, not
  // its margin — consistent with how spotHoldings values a spot holding at
  // its full market value, not what was paid for it.
  const assetBreakdown = useMemo(() => {
    const bySymbol = new Map<string, number>();
    for (const h of spotHoldings) {
      if (h.value > 0) bySymbol.set(h.asset, (bySymbol.get(h.asset) ?? 0) + h.value);
    }
    for (const p of positions) {
      const base = p.symbol.split("-")[0] ?? p.symbol;
      if (p.value > 0) bySymbol.set(base, (bySymbol.get(base) ?? 0) + p.value);
    }
    const total = Array.from(bySymbol.values()).reduce((s, v) => s + v, 0);
    return Array.from(bySymbol.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([asset, value], i) => ({
        asset,
        value,
        pct: total > 0 ? (value / total) * 100 : 0,
        color: BREAKDOWN_COLORS[i % BREAKDOWN_COLORS.length],
      }));
  }, [spotHoldings, positions]);

  // Real per-area wallet breakdown (Phase 6 of
  // ~/.claude/plans/wallet-separation.md) — replaces the old fabricated
  // FROZEN_AMOUNT bucket list. Spot's own total (holdings' locked/reserved
  // across every asset, valued at 1:1 since these are all BI2XUSD-
  // denominated raw figures from the wallet, not priced holdings) is
  // included alongside Futures/Staking/Prediction so the card reads as one
  // consistent "where is my money" view instead of mixing a priced-holdings
  // figure with raw wallet totals.
  const areaBreakdown = useMemo(() => {
    const spotTotal = walletState.balances.reduce((sum, b) => sum + b.amount, 0);
    const areas = walletState.balancesByArea;
    return [
      { area: "Spot", total: spotTotal, known: true },
      { area: "Futures", total: areas.FUTURES?.total ?? 0, known: areas.FUTURES !== undefined },
      { area: "Staking", total: areas.STAKING?.total ?? 0, known: areas.STAKING !== undefined },
      { area: "Prediction", total: areas.PREDICTION?.total ?? 0, known: areas.PREDICTION !== undefined },
    ];
  }, [walletState.balances, walletState.balancesByArea]);
  const totalAcrossAreas = areaBreakdown.reduce((sum, a) => sum + (a.known ? a.total : 0), 0);

  const dbBalances = useMemo(() => {
    const amountFor = (asset: string) => walletState.balances.find((balance) => balance.asset === asset)?.available ?? 0;
    // BI2XUSD is the tradable balance every market actually settles in; USDC/
    // USDT are shown too since a real deposit briefly exists in one of
    // those before the chain listener converts it to BI2XUSD (see useWallet.ts).
    const bi2xusd = amountFor("BI2XUSD");
    const usdc = amountFor("USDC");
    const usdt = amountFor("USDT");

    return {
      totalFunds: bi2xusd + usdc + usdt,
      BI2XUSD: bi2xusd,
      USDC: usdc,
      USDT: usdt,
    };
  }, [walletState.balances]);

  useEffect(() => {
    if (!walletState.connected) return;
    wallet.refreshBalances().catch(() => {});
  }, [walletState.connected]);

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Portfolio</h1>
            <p className="text-muted-foreground text-sm mt-1">Account overview, performance, and analytics</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => openTransfer("deposit")} className="flex-1 sm:flex-none bg-buy/15 text-buy hover:bg-buy/25 border border-buy/30 h-9" variant="outline">
              <ArrowDownToLine className="h-3.5 w-3.5 mr-1.5" /> Deposit
            </Button>
            <Button onClick={() => openTransfer("withdraw")} variant="outline" className="flex-1 sm:flex-none glass h-9">
              <ArrowUpFromLine className="h-3.5 w-3.5 mr-1.5" /> Withdraw
            </Button>
            <Button asChild variant="outline" className="flex-1 sm:flex-none glass h-9">
              <Link to="/portfolio/transactions">
                <History className="h-3.5 w-3.5 mr-1.5" /> Transaction History
              </Link>
            </Button>
          </div>
        </div>

        {/* Key stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard label="Total Funds" value={formatTokenAmount(dbBalances.totalFunds)} sub="BI2XUSD + USDC + USDT" icon={DollarSign} highlight />
          <StatCard label="BI2XUSD" value={formatTokenAmount(dbBalances.BI2XUSD)} sub="Tradable Balance" icon={Wallet} />
          <StatCard label="USDC" value={formatTokenAmount(dbBalances.USDC)} sub="Available Balance" icon={Wallet} />
          <StatCard label="USDT" value={formatTokenAmount(dbBalances.USDT)} sub="Available Balance" icon={Wallet} />
        </div>

        {/* Per-area wallet breakdown — Spot/Futures/Staking/Prediction, each
            its own funding pool (Phase 6 of
            ~/.claude/plans/wallet-separation.md). An area showing "—"
            means it couldn't be loaded just now (e.g. the engine briefly
            unreachable for Futures), not that it's genuinely zero. */}
        <div className="glass rounded-xl p-4 border border-primary/25">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" /> Wallet Areas</h3>
            <span className="text-xs text-muted-foreground">Total: <span className="font-mono text-foreground">{formatTokenAmount(totalAcrossAreas)}</span></span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {areaBreakdown.map((item) => (
              <div key={item.area} className="glass rounded-lg p-2.5">
                <div className="text-[10px] text-muted-foreground">{item.area}</div>
                <div className="font-mono font-bold text-sm mt-0.5">{item.known ? formatTokenAmount(item.total) : "—"}</div>
              </div>
            ))}
          </div>
        </div>

        <EquityChart points={equityPoints} pnl={totalPnl} winRate={tradeStats.winRate} avgTrade={tradeStats.avgTrade} />

        {/* Asset Breakdown — real priced holdings (Spot balances + open
            Futures notional), not the old hardcoded mock list. Moved below
            the Equity Curve per request. */}
        <div className="glass rounded-xl p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><PieChart className="h-4 w-4 text-primary" /> Asset Breakdown</h3>
          {assetBreakdown.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-6">No priced holdings yet — your Spot balances and open Futures positions will show up here.</div>
          ) : (
            <div className="space-y-2.5">
              {assetBreakdown.map(a => (
                <div key={a.asset}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium">{a.asset}</span>
                    <span className="text-muted-foreground">${a.value.toLocaleString(undefined, { maximumFractionDigits: 2 })} · {a.pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${a.pct}%`, background: a.color }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Spot Holdings — moved here from the trade page's Positions panel
            "Holdings" tab, since a spot balance is account-wide, not tied to
            whichever symbol you happen to be trading. */}
        <div className="glass rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2"><Layers className="h-4 w-4 text-primary" /> Spot Holdings</h3>
            <span className="text-xs text-muted-foreground">{spotHoldings.length} assets</span>
          </div>
          {spotHoldings.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">No spot holdings yet. Buy a spot asset to see it here.</div>
          ) : (
          <div className="overflow-x-auto scrollbar-none">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="text-[11px] text-muted-foreground uppercase">
                <tr className="border-b border-border/50">
                  <th className="text-left px-4 py-2">Asset</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Available</th>
                  <th className="text-right">Order-Reserved</th>
                  <th className="text-right">Price</th>
                  <th className="text-right pr-4">Value</th>
                </tr>
              </thead>
              <tbody>
                {spotHoldings.map((h) => (
                  <tr key={h.asset} className="border-b border-border/30 hover:bg-muted/20">
                    <td className="px-4 py-3 font-semibold">{h.asset}</td>
                    <td className="text-right font-mono">{h.amount.toFixed(4)}</td>
                    <td className="text-right font-mono text-buy">{h.available.toFixed(4)}</td>
                    <td className="text-right font-mono text-muted-foreground">{h.tradingLocked.toFixed(4)}</td>
                    <td className="text-right font-mono text-muted-foreground">{h.price > 0 ? formatPrice(h.price) : "—"}</td>
                    <td className="text-right pr-4 font-mono font-bold">${h.value.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>

      </div>
      <TransferDialog open={transferOpen} onOpenChange={setTransferOpen} defaultMode={transferMode} />
    </AppShell>
  );
};

function formatTokenAmount(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: value >= 1 ? 2 : 6,
  });
}

function StatCard({ label, value, sub, icon: Icon, tone, highlight }: { label: string; value: string; sub?: string; icon: any; tone?: "buy" | "sell"; highlight?: boolean }) {
  return (
    <div className={cn("glass rounded-xl p-4 relative overflow-hidden", highlight && "border border-primary/30")}>
      {highlight && <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />}
      <div className="relative flex items-center justify-between mb-2">
        <span className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</span>
        <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center", highlight ? "bg-primary/20" : "bg-muted/30")}>
          <Icon className={cn("h-3.5 w-3.5", tone === "buy" ? "text-buy" : tone === "sell" ? "text-sell" : "text-primary")} />
        </div>
      </div>
      <div className={cn("relative text-xl font-bold font-mono", tone === "buy" && "text-buy", tone === "sell" && "text-sell", highlight && "gradient-text")}>{value}</div>
      {sub && <div className="relative text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

// points: cumulative realized PnL, oldest first, with the current
// unrealized PnL appended as the live final point (see equityPoints' own
// doc comment on why this is a realized-PnL curve, not a full account-value
// history). Needs at least 2 points to draw a line; fewer (an account with
// no closed trades yet) shows an empty-state message instead of a
// misleadingly flat/fabricated line.
function EquityChart({ points, pnl, winRate, avgTrade }: { points: number[]; pnl: number; winRate: number | null; avgTrade: number | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || points.length < 2) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`; canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;
    const min = Math.min(...points, 0), max = Math.max(...points, 0);
    const range = (max - min) || 1;
    const lineColor = pnl >= 0 ? "hsl(145 65% 52%)" : "hsl(0 70% 60%)";
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, pnl >= 0 ? "hsl(145 65% 52% / 0.35)" : "hsl(0 70% 60% / 0.35)");
    grad.addColorStop(1, pnl >= 0 ? "hsl(145 65% 52% / 0)" : "hsl(0 70% 60% / 0)");
    const yFor = (v: number) => H - ((v - min) / range) * H * 0.85 - 10;
    ctx.beginPath();
    points.forEach((v, i) => { const x = (i / (points.length - 1)) * W; const y = yFor(v); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
    ctx.beginPath();
    points.forEach((v, i) => { const x = (i / (points.length - 1)) * W; const y = yFor(v); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
    ctx.strokeStyle = lineColor; ctx.lineWidth = 2; ctx.shadowColor = lineColor; ctx.shadowBlur = 8; ctx.stroke();
  }, [points, pnl]);

  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /> Equity Curve</h3>
        <span className="text-[10px] text-muted-foreground">Cumulative realized PnL</span>
      </div>
      <div ref={containerRef} className="h-48 relative">
        {points.length < 2 ? (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">No closed trades yet — this fills in as you trade.</div>
        ) : (
          <canvas ref={canvasRef} className="absolute inset-0" />
        )}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
        <div className="glass rounded-lg p-2 text-center">
          <div className="text-muted-foreground text-[10px]">Unrealized PnL</div>
          <div className={cn("font-bold mt-0.5", pnl >= 0 ? "text-buy" : "text-sell")}>{pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}</div>
        </div>
        <div className="glass rounded-lg p-2 text-center">
          <div className="text-muted-foreground text-[10px]">Win Rate</div>
          <div className="font-bold mt-0.5">{winRate === null ? "—" : `${winRate.toFixed(1)}%`}</div>
        </div>
        <div className="glass rounded-lg p-2 text-center">
          <div className="text-muted-foreground text-[10px]">Avg. Trade</div>
          <div className={cn("font-bold mt-0.5", avgTrade === null ? "text-muted-foreground" : avgTrade >= 0 ? "text-buy" : "text-sell")}>
            {avgTrade === null ? "—" : `${avgTrade >= 0 ? "+" : ""}$${avgTrade.toFixed(2)}`}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Portfolio;
