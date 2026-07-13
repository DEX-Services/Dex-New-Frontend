import { useCallback, useEffect, useState } from "react";
import { submitOrder, cancelOrder, getOrders, SubmitOrderParams } from "./apiClient";
import { wsClient, WSEvent } from "./wsClient";
import { wallet } from "./useWallet";

export type OpenOrder = {
  id: string;
  symbol: string;
  market: string;
  side: "BUY" | "SELL";
  price?: string;
  qty: string;
  filled: string;
  status: string;
};

export function useOrders(account: string) {
  const [orders, setOrders] = useState<OpenOrder[]>([]);

  useEffect(() => {
    if (!account) return;
    getOrders(account)
      .then((res) =>
        setOrders(
          res.orders.map((o) => ({
            id: o.id,
            symbol: o.symbol,
            market: o.market,
            side: o.side,
            price: o.price,
            qty: o.qty,
            filled: o.filled,
            status: o.status,
          }))
        )
      )
      .catch(() => {});
  }, [account]);

  useEffect(() => {
    const unsub = wsClient.subscribe((evt: WSEvent) => {
      if (!evt.order) return;
      const o = evt.order;
      setOrders((prev) => {
        const idx = prev.findIndex((x) => x.id === o.id);
        if (o.status === "FILLED" || o.status === "CANCELLED" || o.status === "REJECTED") {
          return prev.filter((x) => x.id !== o.id);
        }
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = { ...next[idx], filled: o.filled, status: o.status };
        return next;
      });
    });
    return unsub;
  }, []);

  const place = useCallback(
    async (p: Omit<SubmitOrderParams, "account">) => {
      const res = await submitOrder({ ...p, account });
      setOrders((prev) => [
        ...prev,
        {
          id: res.orderId,
          symbol: p.symbol,
          market: p.market,
          side: p.side,
          price: p.price,
          qty: p.qty,
          filled: res.filled,
          status: res.status,
        },
      ]);
      wallet.refreshBalances().catch(() => {});
      return res;
    },
    [account]
  );

  const cancel = useCallback(async (symbol: string, market: string, orderId: string) => {
    const res = await cancelOrder(symbol, market, orderId);
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
    wallet.refreshBalances().catch(() => {});
    return res;
  }, []);

  return { orders, place, cancel };
}
