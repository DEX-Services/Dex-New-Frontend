export type WSOrder = { id: string; status: string; filled: string };
export type WSTrade = {
  id: string;
  symbol: string;
  market: string;
  price: string;
  quantity: string;
  makerSide: "BUY" | "SELL";
  executedAt: string;
};

export type WSEvent = {
  type: string; // ORDER_OPEN | ORDER_PARTIALLY_FILLED | ORDER_FILLED | ORDER_CANCELLED | ORDER_REJECTED | TRADE | ...
  symbol: string;
  market: string;
  sequenceNumber: number;
  order?: WSOrder;
  trade?: WSTrade;
};

type Listener = (evt: WSEvent) => void;

const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:8080/ws";

class WSClient {
  private socket: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private reconnectDelay = 1000;

  connect() {
    if (this.socket) return;
    const socket = new WebSocket(WS_URL);
    this.socket = socket;
    socket.onmessage = (e) => {
      try {
        const evt: WSEvent = JSON.parse(e.data);
        this.listeners.forEach((l) => l(evt));
      } catch {
        // ignore malformed frame
      }
    };
    socket.onclose = () => {
      if (this.socket === socket) this.socket = null;
      setTimeout(() => this.connect(), this.reconnectDelay);
    };
    socket.onerror = () => socket.close();
  }

  subscribe(listener: Listener) {
    this.connect();
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const wsClient = new WSClient();
