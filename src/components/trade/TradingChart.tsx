import { useEffect, useRef, useId } from "react";
import { INITIAL_MARKETS } from "@/lib/mockData";

function toTradingViewSymbol(symbol: string): string {
  const market = INITIAL_MARKETS.find(m => m.symbol === symbol);
  const asset = market?.asset;
  const base = (market?.base ?? symbol.split("-")[0]).toUpperCase();

  if (asset === "forex") return `FX:${symbol}`;
  if (asset === "stocks") return `NASDAQ:${base}`;
  if (asset === "commodity") {
    const commodityMap: Record<string, string> = {
      GOLD: "TVC:GOLD",
      SILVER: "TVC:SILVER",
      OIL: "TVC:USOIL",
      GAS: "TVC:NATURALGAS",
    };
    return commodityMap[base] ?? `TVC:${base}`;
  }
  // crypto (perp/spot/options) -> Binance live price feed on TradingView,
  // using the {BASE}USD pair (e.g. BINANCE:BTCUSD).
  return `BINANCE:${base}USD`;
}

declare global {
  interface Window {
    TradingView?: any;
  }
}

let tvScriptPromise: Promise<void> | null = null;
function loadTradingViewScript(): Promise<void> {
  if (window.TradingView) return Promise.resolve();
  if (tvScriptPromise) return tvScriptPromise;
  tvScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return tvScriptPromise;
}

function ChartPane({ symbol, timeframe }: { symbol: string; timeframe: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useId().replace(/:/g, "");
  const tvSymbol = toTradingViewSymbol(symbol);
  const widgetRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = "";
    container.id = widgetId;

    const isLight = document.documentElement.getAttribute("data-theme") === "light";

    loadTradingViewScript().then(() => {
      if (cancelled || !window.TradingView) return;
      widgetRef.current = new window.TradingView.widget({
        autosize: true,
        symbol: tvSymbol,
        interval: timeframe,
        timezone: "Etc/UTC",
        theme: isLight ? "light" : "dark",
        style: "1",
        locale: "en",
        enable_publishing: false,
        allow_symbol_change: false,
        save_image: false,
        calendar: false,
        hide_top_toolbar: false,
        hide_legend: false,
        hide_side_toolbar: false,
        container_id: widgetId,
        studies: ["Volume@tv-basicstudies"],
        disabled_features: [
          "header_compare",
          "compare_symbol",
          "header_symbol_search",
          "symbol_search_hot_key",
          "study_templates",
          "popup_hints",
        ],
      });
    });

    return () => {
      cancelled = true;
      if (widgetRef.current?.remove && container.isConnected) {
        try {
          widgetRef.current.remove();
        } catch {
          // tv.js widget teardown can throw if its internal DOM node was
          // already detached (e.g. rapid symbol switches); safe to ignore.
        }
      }
      widgetRef.current = null;
    };
  }, [tvSymbol, timeframe, widgetId]);

  return <div ref={containerRef} className="h-full w-full" />;
}

const LAYOUTS = [
  { id: "1", label: "1", cols: 1, rows: 1 },
  { id: "2v", label: "2 ↔", cols: 2, rows: 1 },
  { id: "2h", label: "2 ↕", cols: 1, rows: 2 },
  { id: "4", label: "4", cols: 2, rows: 2 },
];

export function TradingChart({ symbol }: { symbol: string; price?: number }) {
  const tf = "15";
  const layout = LAYOUTS[0];
  const panes = layout.cols * layout.rows;

  return (
    <div className="glass rounded-b-xl rounded-t-none flex flex-col h-full overflow-hidden">
      <div
        className="flex-1 grid gap-1 p-1 min-h-0"
        style={{
          gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${layout.rows}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: panes }).map((_, i) => (
          <div key={i} className="glass-strong rounded-lg overflow-hidden border border-border/40 min-h-0">
            <ChartPane symbol={symbol} timeframe={tf} />
          </div>
        ))}
      </div>
    </div>
  );
}
