import { useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Coins } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

// Same allocation breakdown as the public Tokenomics page (src/pages/Token.tsx's
// SUPPLY_ALLOC) — kept as a separate literal here rather than importing from
// that page, since Token.tsx doesn't export it and the two pages intentionally
// serve different audiences (public marketing page vs. internal admin
// reference), even though the underlying numbers must stay in sync by hand
// if the allocation ever changes.
const TOTAL_SUPPLY = 500_000_000; // 500M BI2X

const SUPPLY_ALLOC = [
  { name: "Initial Burn → BI2XUSD stablecoin", value: 6, color: "#fb7185" },
  { name: "Team Reserve", value: 5, color: "#6366f1" },
  { name: "Community", value: 2, color: "#00e5ff" },
  { name: "Airdrop", value: 3, color: "#f472b6" },
  { name: "Marketing", value: 4, color: "#f59e0b" },
  { name: "Treasury Reserve", value: 4, color: "#ef4444" },
  { name: "Initial Liquidity", value: 2, color: "#10b981" },
  { name: "Staking Reward", value: 74, color: "#a855f7" },
];

function formatTokens(qty: number): string {
  return qty.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export default function AdminBI2XTokenDetails() {
  useEffect(() => {
    document.title = "BI2X Token Details | Admin | BitDx";
  }, []);

  const totalAllocatedPct = SUPPLY_ALLOC.reduce((sum, s) => sum + s.value, 0);

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">BI2X Token Details</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Total supply and allocation breakdown for the BI2X token
          </p>
        </div>

        <div className="glass rounded-xl p-5 sm:p-6 space-y-1">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
              <Coins className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Total Supply</div>
              <div className="text-2xl font-bold font-mono">{formatTokens(TOTAL_SUPPLY)} BI2X</div>
            </div>
          </div>
        </div>

        <div className="glass rounded-xl p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Allocation Breakdown</h2>
            {totalAllocatedPct !== 100 && (
              <span className="text-[11px] text-warning">
                Allocations sum to {totalAllocatedPct}%, not 100% — figures below are shown as configured.
              </span>
            )}
          </div>

          <div className="grid md:grid-cols-[220px_1fr] gap-6 items-center">
            <div className="relative h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={SUPPLY_ALLOC} cx="50%" cy="50%" innerRadius={65} outerRadius={100} dataKey="value" stroke="none">
                    {SUPPLY_ALLOC.map((s, i) => <Cell key={i} fill={s.color} />)}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      `${value}% (${formatTokens(Math.round((value / 100) * TOTAL_SUPPLY))} BI2X)`,
                      name,
                    ]}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</div>
                <div className="text-sm font-bold font-mono">{formatTokens(TOTAL_SUPPLY)}</div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] text-muted-foreground uppercase tracking-wide border-b border-border/50">
                    <th className="text-left font-medium py-2">Category</th>
                    <th className="text-right font-medium py-2">Percentage</th>
                    <th className="text-right font-medium py-2">Quantity (BI2X)</th>
                  </tr>
                </thead>
                <tbody>
                  {SUPPLY_ALLOC.map((s) => {
                    const qty = Math.round((s.value / 100) * TOTAL_SUPPLY);
                    return (
                      <tr key={s.name} className="border-b border-border/30 last:border-0">
                        <td className="py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: s.color }} />
                            <span className="text-foreground">{s.name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 text-right font-mono font-semibold">{s.value}%</td>
                        <td className="py-2.5 text-right font-mono">{formatTokens(qty)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border/50">
                    <td className="py-2.5 font-semibold">Total</td>
                    <td className="py-2.5 text-right font-mono font-semibold">{totalAllocatedPct}%</td>
                    <td className="py-2.5 text-right font-mono font-semibold">
                      {formatTokens(Math.round((totalAllocatedPct / 100) * TOTAL_SUPPLY))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
