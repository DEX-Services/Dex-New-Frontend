import { useCallback, useEffect, useRef, useState } from "react";
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
  // Set only for a take-profit or stop-loss leg belonging to an attached
  // order group; empty for a regular standalone order.
  groupId?: string;
  groupRole?: "TP" | "SL";
};

const TERMINAL = new Set(["FILLED", "CANCELLED", "REJECTED"]);

export function useOrders(account: string) {
  // Authoritative state is a map keyed by order id, so HTTP snapshots, WS
  // deltas, optimistic local placements, and resync refetches all merge on the
  // same key instead of racing to append/splice a positional array. The
  // rendered array is derived from it.
  const ordersRef = useRef<Map<string, OpenOrder>>(new Map());
  const [orders, setOrders] = useState<OpenOrder[]>([]);

  const publish = useCallback(() => {
    setOrders(Array.from(ordersRef.current.values()));
  }, []);

  const applySnapshot = useCallback(
    (list: OpenOrder[]) => {
      // A full refetch is the source of truth: rebuild the map from it, but keep
      // any optimistic local order the server hasn't acknowledged yet (its id is
      // engine-assigned, so once it's in a snapshot it dedupes by id naturally).
      const next = new Map<string, OpenOrder>();
      for (const o of list) {
        if (!TERMINAL.has(o.status)) next.set(o.id, o);
      }
      ordersRef.current = next;
      publish();
    },
    [publish]
  );

  const refetch = useCallback(() => {
    if (!account) return Promise.resolve();
    return getOrders(account)
      .then((res) => applySnapshot(res.orders as OpenOrder[]))
      .catch(() => {
        /* leave last-known state in place on failure */
      });
  }, [account, applySnapshot]);

  // Refetch coalescing: at most one getOrders() per 750ms with a trailing
  // call. Before this, the WS effect called refetch() on EVERY order event we
  // didn't already have — and the stream broadcasts all accounts' MM churn
  // (~9 events/s), so a user with the trade page open re-pulled their whole
  // order list nearly continuously.
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refetchPending = useRef(false);
  const throttledRefetch = useCallback(() => {
    if (refetchTimer.current) {
      refetchPending.current = true;
      return;
    }
    void refetch();
    refetchTimer.current = setTimeout(() => {
      refetchTimer.current = null;
      if (refetchPending.current) {
        refetchPending.current = false;
        throttledRefetch();
      }
    }, 750);
  }, [refetch]);

  // Initial load + reload when the account changes.
  useEffect(() => {
    ordersRef.current = new Map();
    publish();
    refetch();
  }, [account, refetch, publish]);

  // Live deltas from the WS stream.
  useEffect(() => {
    const unsub = wsClient.subscribe((evt: WSEvent) => {
      if (!evt.order) return;
      const o = evt.order;
      // Account scoping: ignore events belonging to other accounts (the
      // engine tags orders with accountId; the MM desks' churn then never
      // reaches this hook at all). If accountId is absent (older engine),
      // fall through — can't distinguish, so keep the old behavior.
      if (o.accountId && o.accountId !== account) return;
      const map = ordersRef.current;
      if (TERMINAL.has(o.status)) {
        if (map.delete(o.id)) publish();
        return;
      }
      const existing = map.get(o.id);
      if (existing) {
        map.set(o.id, { ...existing, filled: o.filled, status: o.status });
      } else {
        // We learned about an order we didn't have (e.g. placed on another
        // device/tab). We only have partial fields from the event; refetch
        // to fill in the rest authoritatively rather than render a
        // half-order. Coalesced so a burst still costs one request.
        throttledRefetch();
        return;
      }
      publish();
    });
    return unsub;
  }, [publish, refetch, throttledRefetch, account]);

  // Subscription filtering: request the streams this account actively trades
  // on (initial load + as orders are observed), so the hub can stop fanning
  // out all markets' churn to this tab. Additive-only and re-sent on
  // reconnect by wsClient itself.
  useEffect(() => {
    const streams = Array.from(ordersRef.current.values()).map((o) => `${o.symbol}|${o.market}`);
    if (streams.length > 0) wsClient.wantStreams(streams);
  }, [orders]);

  // A sequence gap means we dropped WS events and our local view may be stale:
  // resync from the authoritative HTTP endpoint (throttled like the rest).
  useEffect(() => {
    const unsub = wsClient.onGap(() => {
      throttledRefetch();
    });
    return unsub;
  }, [throttledRefetch]);

  const place = useCallback(
    async (p: Omit<SubmitOrderParams, "account">) => {
      const res = await submitOrder({ ...p, account });
      if (!TERMINAL.has(res.status)) {
        ordersRef.current.set(res.orderId, {
          id: res.orderId,
          symbol: p.symbol,
          market: p.market,
          side: p.side,
          price: p.price,
          qty: p.qty,
          filled: res.filled,
          status: res.status,
        });
        publish();
      }
      wallet.refreshBalances().catch(() => {});
      return res;
    },
    [account, publish]
  );

  const cancel = useCallback(
    async (symbol: string, market: string, orderId: string) => {
      const res = await cancelOrder(symbol, market, orderId);
      if (ordersRef.current.delete(orderId)) publish();
      wallet.refreshBalances().catch(() => {});
      return res;
    },
    [publish]
  );

  return { orders, place, cancel, refetch };
}
