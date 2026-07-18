import { useCallback, useEffect, useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useMarkets } from "@/lib/useMarkets";
import { formatPrice } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Bot, Sparkles, X } from "lucide-react";
import { getPositions, FuturesPositionDTO, OptionsPositionDTO } from "@/lib/apiClient";
import { frontendSymbolFor, maintenanceMarginRateFor } from "@/lib/backendMarkets";
import { useOrders } from "@/lib/useOrders";
import { wsClient, WSEvent } from "@/lib/wsClient";
import { toast } from "sonner";

type FundingEntry = {
  time: string;
  symbol: string;
  rate: string;
  payment: number;
};

const MOCK_HISTORY = [
  { time: "11:42", symbol: "ETH-PERP", side: "buy", size: 1.2, price: 3512.3, status: "Filled", pnl: "+$84.20" },
  { time: "10:18", symbol: "SOL-PERP", side: "sell", size: 25, price: 170.4, status: "Filled", pnl: "-$32.50" },
  { time: "09:55", symbol: "BTC-PERP", side: "buy", size: 0.08, price: 66900, status: "Cancelled", pnl: "—" },
];

const MOCK_AUTOMATED_ORDERS = [
  { id: "auto_001", source: "Bot", name: "BTC Grid", strategy: "Futures Grid", symbol: "BTC-PERP", side: "buy", type: "Limit", size: 0.025, price: 66540, status: "Working" },
  { id: "auto_002", source: "AI Agent", name: "Momentum Flow", strategy: "Trend Follow", symbol: "ETH-PERP", side: "sell", type: "Stop", size: 0.8, price: 3495, status: "Watching" },
  { id: "auto_003", source: "Bot", name: "SOL DCA", strategy: "Futures DCA", symbol: "SOL-PERP", side: "buy", type: "Limit", size: 12, price: 158.6, status: "Working" },
  { id: "auto_004", source: "AI Agent", name: "Risk Rebalance", strategy: "Rebalancing", symbol: "HYPE-PERP", side: "sell", type: "Market", size: 20, price: 29.84, status: "Queued" },
] as const;

export function PositionsPanel({
  markets,
  account,
  orders,
}: {
  markets: ReturnType<typeof useMarkets>;
  account: string;
  orders: ReturnType<typeof useOrders>;
}) {
  const [futuresPositions, setFuturesPositions] = useState<FuturesPositionDTO[]>([]);
  const [optionsPositions, setOptionsPositions] = useState<OptionsPositionDTO[]>([]);
  const [fundingHistory, setFundingHistory] = useState<FundingEntry[]>([]);
  const [closing, setClosing] = useState<string | null>(null);

  const futuresOrders = orders.orders.filter(o => o.market === "FUTURES");
  const optionsOrders = orders.orders.filter(o => o.market === "OPTIONS");

  const refetchPositions = useCallback(() => {
    if (!account) return;
    getPositions(account)
      .then((res) => {
        setFuturesPositions(res.futures ?? []);
        setOptionsPositions(res.options ?? []);
      })
      .catch(() => {});
  }, [account]);

  useEffect(() => {
    const unsub = wsClient.subscribe((evt: WSEvent) => {
      if (evt.type !== "FUNDING" || !evt.funding) return;
      const entry: FundingEntry = {
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        symbol: evt.funding.symbol,
        rate: (parseFloat(evt.funding.rate) * 100).toFixed(4) + "%",
        payment: parseFloat(evt.funding.payment),
      };
      setFundingHistory((prev) => [entry, ...prev].slice(0, 50));
    });
    return unsub;
  }, []);

  const handleCancel = async (symbol: string, market: string, orderId: string) => {
    try {
      await orders.cancel(symbol, market, orderId);
      toast.success("Order cancelled");
    } catch (err) {
      toast.error("Cancel failed", { description: err instanceof Error ? err.message : String(err) });
    }
  };

  const handleClose = async (p: { symbol: string; side: "long" | "short"; size: number }) => {
    setClosing(p.symbol);
    try {
      // Close = opposing MARKET order that reduces the position. It only
      // reduces if there is opposing liquidity in the book, so inspect the
      // actual fill instead of assuming success.
      const res = await orders.place({
        symbol: p.symbol,
        market: "FUTURES",
        side: p.side === "long" ? "SELL" : "BUY",
        type: "MARKET",
        qty: String(p.size),
      });
      const filled = parseFloat(res.filled || "0");
      if (filled <= 0) {
        toast.error("Position not closed", {
          description: "No opposing liquidity in the order book to fill the close. Try again or place a limit order.",
        });
      } else if (filled < p.size) {
        toast.warning("Position partially closed", {
          description: `Filled ${filled} of ${p.size}. Remainder still open.`,
        });
      } else {
        toast.success("Position closed");
      }
      // Reflect the new position state immediately regardless of outcome.
      refetchPositions();
    } catch (err) {
      toast.error("Close failed", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setClosing(null);
    }
  };

  useEffect(() => {
    if (!account) {
      // Wallet is connected but the backend userId hasn't resolved yet
      // (see useAccount) - wait rather than fetching/displaying stale or
      // wrong-account positions.
      setFuturesPositions([]);
      setOptionsPositions([]);
      return;
    }
    let cancelled = false;
    const fetchPositions = () => {
      getPositions(account)
        .then((res) => {
          if (cancelled) return;
          setFuturesPositions(res.futures ?? []);
          setOptionsPositions(res.options ?? []);
        })
        .catch(() => {
          if (!cancelled) {
            setFuturesPositions([]);
            setOptionsPositions([]);
          }
        });
    };
    fetchPositions();
    const interval = setInterval(fetchPositions, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [account]);

  const positions = useMemo(() => {
    return futuresPositions.map(p => {
      const size = parseFloat(p.size);
      const entry = parseFloat(p.entryPrice);
      const displaySymbol = frontendSymbolFor(p.symbol, "FUTURES");
      const mark = markets.find(mk => mk.symbol === displaySymbol)?.price ?? parseFloat(p.markPrice);
      const side = p.side === "BUY" ? "long" as const : "short" as const;
      const leverage = p.leverage || 1;
      const margin = parseFloat(p.margin);
      const direction = side === "long" ? 1 : -1;
      const pnl = (mark - entry) * size * direction;
      const pnlPct = margin !== 0 ? (pnl / margin) * 100 : 0;
      // Liquidation price derived from the backend's MarginRatio < MMR rule:
      //   long:  liq = entry * (1 - 1/lev) / (1 - MMR)
      //   short: liq = entry * (1 + 1/lev) / (1 - MMR)
      const mmr = maintenanceMarginRateFor(p.symbol);
      const liq = side === "long"
        ? (entry * (1 - 1 / leverage)) / (1 - mmr)
        : (entry * (1 + 1 / leverage)) / (1 + mmr);
      return { symbol: p.symbol, side, size, entry, leverage, margin, mark, pnl, pnlPct, liq, direction };
    });
  }, [futuresPositions, markets]);

  const totalPnl = positions.reduce((s, p) => s + p.pnl, 0);

  return (
    <div className="glass rounded-b-xl rounded-t-none h-full flex flex-col overflow-hidden">
      <Tabs defaultValue="positions" className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border/50 px-3">
          <div className="min-w-0 flex-1 overflow-x-auto scrollbar-none">
            <TabsList className="h-9 w-max bg-transparent p-0 gap-1">
              <TabsTrigger value="positions" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs h-7">
                Position <span className="ml-1.5 px-1.5 py-0.5 rounded bg-primary/20 text-[10px]">{positions.length}</span>
              </TabsTrigger>
              <TabsTrigger value="futuresOrders" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs h-7">
                Futures Orders <span className="ml-1.5 px-1.5 py-0.5 rounded bg-muted text-[10px]">{futuresOrders.length}</span>
              </TabsTrigger>
              <TabsTrigger value="optionsOrders" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs h-7">
                Options Orders <span className="ml-1.5 px-1.5 py-0.5 rounded bg-muted text-[10px]">{optionsOrders.length}</span>
              </TabsTrigger>
              <TabsTrigger value="automated" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs h-7">
                Bot / AI Agent <span className="ml-1.5 px-1.5 py-0.5 rounded bg-secondary/15 text-secondary text-[10px]">{MOCK_AUTOMATED_ORDERS.length}</span>
              </TabsTrigger>
              <TabsTrigger value="trades" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs h-7">Trade History</TabsTrigger>
              <TabsTrigger value="funding" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs h-7">Funding History</TabsTrigger>
              <TabsTrigger value="history" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs h-7">Order History</TabsTrigger>
            </TabsList>
          </div>
          <div className="shrink-0 text-[11px] text-muted-foreground">
            Total PnL: <span className={cn("font-mono font-bold", totalPnl >= 0 ? "text-buy" : "text-sell")}>
              {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
            </span>
          </div>
        </div>

        <TabsContent value="positions" className="flex-1 overflow-auto m-0">
          <table className="w-full text-[11px] font-mono">
            <thead className="text-[10px] text-muted-foreground uppercase">
              <tr className="border-b border-border/50">
                <th className="text-left px-3 py-1.5">Symbol</th>
                <th className="text-left">Side</th>
                <th className="text-right">Size</th>
                <th className="text-right">Entry</th>
                <th className="text-right">Mark</th>
                <th className="text-right">Liq.</th>
                <th className="text-right">Margin</th>
                <th className="text-right">PnL</th>
                <th className="text-right pr-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {positions.map(p => (
                <tr key={p.symbol} className="border-b border-border/30 hover:bg-muted/20">
                  <td className="px-3 py-2 font-sans font-semibold">{p.symbol} <span className="text-[9px] text-muted-foreground">{p.leverage}x</span></td>
                  <td className={p.side === "long" ? "text-buy" : "text-sell"}>{p.side.toUpperCase()}</td>
                  <td className="text-right">{p.size}</td>
                  <td className="text-right">{formatPrice(p.entry)}</td>
                  <td className="text-right">{formatPrice(p.mark)}</td>
                  <td className="text-right text-warning">{formatPrice(p.liq)}</td>
                  <td className="text-right">${p.margin.toFixed(2)}</td>
                  <td className={cn("text-right font-bold", p.pnl >= 0 ? "text-buy" : "text-sell")}>
                    {p.pnl >= 0 ? "+" : ""}${p.pnl.toFixed(2)}
                    <div className="text-[9px] opacity-70">{p.pnl >= 0 ? "+" : ""}{p.pnlPct.toFixed(2)}%</div>
                  </td>
                  <td className="text-right pr-3">
                    <Button size="sm" variant="ghost" disabled={closing === p.symbol}
                      className="h-6 text-[10px] text-sell hover:bg-sell/10 disabled:opacity-50"
                      onClick={() => handleClose(p)}>{closing === p.symbol ? "Closing…" : "Close"}</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {optionsPositions.length > 0 && (
            <table className="w-full text-[11px] font-mono">
              <thead className="text-[10px] text-muted-foreground uppercase">
                <tr className="border-b border-border/50">
                  <th className="text-left px-3 py-1.5">Symbol</th>
                  <th className="text-left">Type</th>
                  <th className="text-right">Strike</th>
                  <th className="text-right">Expiry</th>
                  <th className="text-right">Size</th>
                  <th className="text-right pr-3">Premium</th>
                </tr>
              </thead>
              <tbody>
                {optionsPositions.map(p => (
                  <tr key={`${p.symbol}-${p.strikePrice}-${p.expiry}-${p.optionType}`} className="border-b border-border/30 hover:bg-muted/20">
                    <td className="px-3 py-2 font-sans font-semibold">{p.symbol}</td>
                    <td className={p.optionType === "CALL" ? "text-buy" : "text-sell"}>{p.optionType}</td>
                    <td className="text-right">{formatPrice(parseFloat(p.strikePrice))}</td>
                    <td className="text-right">{new Date(p.expiry).toLocaleDateString()}</td>
                    <td className="text-right">{p.size}</td>
                    <td className="text-right pr-3">${parseFloat(p.premium).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </TabsContent>

        <TabsContent value="futuresOrders" className="flex-1 overflow-auto m-0">
          {futuresOrders.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-6 text-xs text-muted-foreground">No open futures orders.</div>
          ) : (
            <table className="w-full text-[11px] font-mono">
              <thead className="text-[10px] text-muted-foreground uppercase">
                <tr className="border-b border-border/50">
                  <th className="text-left px-3 py-1.5">Symbol</th>
                  <th className="text-left">Side</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Price</th>
                  <th className="text-right">Filled</th>
                  <th className="text-right">Status</th>
                  <th className="text-right pr-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {futuresOrders.map(o => (
                  <tr key={o.id} className="border-b border-border/30 hover:bg-muted/20">
                    <td className="px-3 py-2 font-sans font-semibold">{o.symbol}</td>
                    <td className={o.side === "BUY" ? "text-buy" : "text-sell"}>{o.side}</td>
                    <td className="text-right">{o.qty}</td>
                    <td className="text-right">{o.price ? formatPrice(Number(o.price)) : "MKT"}</td>
                    <td className="text-right text-muted-foreground">{o.filled}</td>
                    <td className="text-right text-muted-foreground">{o.status}</td>
                    <td className="text-right pr-3">
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-sell"
                        onClick={() => handleCancel(o.symbol, o.market, o.id)}><X className="h-3 w-3" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </TabsContent>

        <TabsContent value="optionsOrders" className="flex-1 overflow-auto m-0">
          {optionsOrders.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-6 text-xs text-muted-foreground">No open options orders.</div>
          ) : (
            <table className="w-full text-[11px] font-mono">
              <thead className="text-[10px] text-muted-foreground uppercase">
                <tr className="border-b border-border/50">
                  <th className="text-left px-3 py-1.5">Symbol</th>
                  <th className="text-left">Side</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Price</th>
                  <th className="text-right">Filled</th>
                  <th className="text-right">Status</th>
                  <th className="text-right pr-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {optionsOrders.map(o => (
                  <tr key={o.id} className="border-b border-border/30 hover:bg-muted/20">
                    <td className="px-3 py-2 font-sans font-semibold">{o.symbol}</td>
                    <td className={o.side === "BUY" ? "text-buy" : "text-sell"}>{o.side}</td>
                    <td className="text-right">{o.qty}</td>
                    <td className="text-right">{o.price ? formatPrice(Number(o.price)) : "MKT"}</td>
                    <td className="text-right text-muted-foreground">{o.filled}</td>
                    <td className="text-right text-muted-foreground">{o.status}</td>
                    <td className="text-right pr-3">
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-sell"
                        onClick={() => handleCancel(o.symbol, o.market, o.id)}><X className="h-3 w-3" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </TabsContent>

        <TabsContent value="automated" className="flex-1 overflow-auto m-0">
          <table className="w-full min-w-[880px] text-[11px] font-mono">
            <thead className="text-[10px] text-muted-foreground uppercase">
              <tr className="border-b border-border/50">
                <th className="text-left px-3 py-1.5">Source</th>
                <th className="text-left">Name</th>
                <th className="text-left">Strategy</th>
                <th className="text-left">Symbol</th>
                <th className="text-left">Side</th>
                <th className="text-left">Type</th>
                <th className="text-right">Size</th>
                <th className="text-right">Price</th>
                <th className="text-right pr-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_AUTOMATED_ORDERS.map(order => (
                <tr key={order.id} className="border-b border-border/30 hover:bg-muted/20">
                  <td className="px-3 py-2">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2 py-1 font-sans text-[10px] font-semibold",
                      order.source === "AI Agent"
                        ? "bg-primary/10 text-primary"
                        : "bg-secondary/15 text-secondary"
                    )}>
                      {order.source === "AI Agent"
                        ? <Sparkles className="h-3 w-3" />
                        : <Bot className="h-3 w-3" />}
                      {order.source}
                    </span>
                  </td>
                  <td className="font-sans font-semibold">{order.name}</td>
                  <td className="text-muted-foreground">{order.strategy}</td>
                  <td className="font-sans font-semibold">{order.symbol}</td>
                  <td className={order.side === "buy" ? "text-buy" : "text-sell"}>{order.side.toUpperCase()}</td>
                  <td>{order.type}</td>
                  <td className="text-right">{order.size}</td>
                  <td className="text-right">{formatPrice(order.price)}</td>
                  <td className="text-right pr-3">
                    <span className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      order.status === "Working"
                        ? "bg-buy/10 text-buy"
                        : order.status === "Watching"
                          ? "bg-primary/10 text-primary"
                          : "bg-warning/10 text-warning"
                    )}>
                      {order.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabsContent>

        <TabsContent value="history" className="flex-1 overflow-auto m-0">
          <table className="w-full text-[11px] font-mono">
            <thead className="text-[10px] text-muted-foreground uppercase">
              <tr className="border-b border-border/50">
                <th className="text-left px-3 py-1.5">Time</th>
                <th className="text-left">Symbol</th>
                <th className="text-left">Side</th>
                <th className="text-right">Size</th>
                <th className="text-right">Price</th>
                <th className="text-right">Status</th>
                <th className="text-right pr-3">PnL</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_HISTORY.map((h, i) => (
                <tr key={i} className="border-b border-border/30 hover:bg-muted/20">
                  <td className="px-3 py-2">{h.time}</td>
                  <td className="font-sans font-semibold">{h.symbol}</td>
                  <td className={h.side === "buy" ? "text-buy" : "text-sell"}>{h.side.toUpperCase()}</td>
                  <td className="text-right">{h.size}</td>
                  <td className="text-right">{formatPrice(h.price)}</td>
                  <td className="text-right text-muted-foreground">{h.status}</td>
                  <td className={cn("text-right pr-3 font-bold", h.pnl.startsWith("+") ? "text-buy" : h.pnl.startsWith("-") ? "text-sell" : "")}>{h.pnl}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabsContent>

        <TabsContent value="trades" className="flex-1 m-0 p-6 text-center text-sm text-muted-foreground">
          No trades yet today. Open a position to start.
        </TabsContent>
        <TabsContent value="funding" className="flex-1 overflow-auto m-0">
          {fundingHistory.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-6 text-xs text-muted-foreground">
              No funding payments yet. Funding settles every 8 hours.
            </div>
          ) : (
            <table className="w-full text-[11px] font-mono">
              <thead className="text-[10px] text-muted-foreground uppercase">
                <tr className="border-b border-border/50">
                  <th className="text-left px-3 py-1.5">Time</th>
                  <th className="text-left">Symbol</th>
                  <th className="text-right">Rate</th>
                  <th className="text-right pr-3">Payment</th>
                </tr>
              </thead>
              <tbody>
                {fundingHistory.map((f, i) => (
                  <tr key={i} className="border-b border-border/30 hover:bg-muted/20">
                    <td className="px-3 py-2">{f.time}</td>
                    <td className="font-sans font-semibold">{f.symbol}</td>
                    <td className={cn("text-right", parseFloat(f.rate) >= 0 ? "text-buy" : "text-sell")}>{f.rate}</td>
                    <td className={cn("text-right pr-3 font-bold", f.payment >= 0 ? "text-buy" : "text-sell")}>
                      {f.payment >= 0 ? "+" : ""}${f.payment.toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
