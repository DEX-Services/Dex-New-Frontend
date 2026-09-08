import { useEffect, useState, useCallback } from "react";
import { getDepth, getTrades } from "./apiClient";
import { wsClient, WSEvent } from "./wsClient";
import type { OrderBookLevel, Trade } from "./mockData";

function toLevel(d: { price: string; size: string; total: string }): OrderBookLevel {
  return { price: Number(d.price), size: Number(d.size), total: Number(d.total) };
}

export function useOrderBook(symbol: string, market: string, levels = 20) {
  const [bids, setBids] = useState<OrderBookLevel[]>([]);
  const [asks, setAsks] = useState<OrderBookLevel[]>([]);

  const refresh = useCallback(() => {
    if (!symbol || !market) return;
    getDepth(symbol, market, levels)
      .then((res) => {
        setBids(res.bids.map(toLevel));
        setAsks(res.asks.map(toLevel));
      })
      .catch(() => {});
  }, [symbol, market, levels]);

  useEffect(() => {
    refresh();
    const unsub = wsClient.subscribe((evt: WSEvent) => {
      if (evt.symbol === symbol && evt.market === market) refresh();
    });
    // A dropped/reconnected WS means we may have silently missed order-book
    // changes for this exact symbol during the gap (a restart resets the
    // engine's sequence numbering entirely) — the event-matching subscribe
    // above has nothing to react to if no fresh event happens to land for
    // THIS symbol soon after. Resync explicitly on any gap and on the
    // connection coming back, same as useOrders already does for its own
    // /orders view, so a stale book self-heals instead of sitting frozen
    // until the next unrelated event for this symbol happens to arrive.
    const unsubGap = wsClient.onGap(() => refresh());
    const unsubStatus = wsClient.onStatus((status) => {
      if (status === "open") refresh();
    });
    return () => {
      unsub();
      unsubGap();
      unsubStatus();
    };
  }, [symbol, market, refresh]);

  return { bids, asks };
}

export function useRecentTrades(symbol: string, market: string, limit = 30) {
  const [trades, setTrades] = useState<Trade[]>([]);

  useEffect(() => {
    if (!symbol || !market) return;
    let cancelled = false;

    const refetch = () => {
      getTrades(symbol, market, limit)
        .then((res) => {
          if (cancelled) return;
          setTrades(
            res.trades.map((t) => ({
              id: t.id,
              price: Number(t.price),
              size: Number(t.quantity),
              side: t.side === "BUY" ? "buy" : "sell",
              time: t.timestamp,
            }))
          );
        })
        .catch(() => {});
    };

    refetch();

    const unsub = wsClient.subscribe((evt: WSEvent) => {
      if (evt.type !== "TRADE" || !evt.trade) return;
      if (evt.symbol !== symbol || evt.market !== market) return;
      const t = evt.trade;
      const takerSide = t.makerSide === "BUY" ? "sell" : "buy";
      setTrades((prev) =>
        [
          {
            id: t.id,
            price: Number(t.price),
            size: Number(t.quantity),
            side: takerSide as "buy" | "sell",
            time: new Date(t.executedAt).getTime(),
          },
          ...prev,
        ].slice(0, limit)
      );
    });
    // Same reasoning as useOrderBook above: a dropped/reconnected WS can
    // silently miss trades for this exact symbol during the gap, and the
    // incremental append above has nothing to react to until the next
    // matching TRADE happens to arrive. A full refetch on gap/reconnect
    // self-heals instead of leaving a stale tape.
    const unsubGap = wsClient.onGap(() => refetch());
    const unsubStatus = wsClient.onStatus((status) => {
      if (status === "open") refetch();
    });

    return () => {
      cancelled = true;
      unsub();
      unsubGap();
      unsubStatus();
    };
  }, [symbol, market, limit]);

  return trades;
}
