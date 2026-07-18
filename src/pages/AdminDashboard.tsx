import { useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, Clock, Database, Landmark, Loader2, Users, Wallet } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAdminDashboard, getAdminP2PAppeals, getAdminP2PPrice, resolveAdminP2PAppeal, setAdminP2PPrice, type AdminSummary } from "@/lib/adminApi";
import { formatINR,formatUSDC,type P2POrder } from "@/lib/p2pApi";
import { cn } from "@/lib/utils";

export default function AdminDashboard() {
  const [data, setData] = useState<AdminSummary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setData(await getAdminDashboard());
    } catch {
      setError("Could not load admin dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = "Admin Dashboard | DEX.ai";
    load();
  }, []);

  const balanceTotal = useMemo(() => {
    return data?.totalBalances.reduce((sum, item) => sum + Number(item.amount || 0), 0) ?? 0;
  }, [data]);

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">Database-backed platform overview</p>
          </div>
          <Button variant="outline" className="glass h-9" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Activity className="h-4 w-4 mr-2" />}
            Refresh
          </Button>
        </div>

        {error && <div className="rounded-lg border border-sell/30 bg-sell/10 px-3 py-2 text-sm text-sell">{error}</div>}

        <P2PPriceCard />
        <P2PAppealsCard />

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <Stat label="Total Users" value={formatNumber(data?.totalUsers)} icon={Users} />
          <Stat label="Active 24h" value={formatNumber(data?.activeUsers24h)} icon={Activity} tone="buy" />
          <Stat label="Open Sessions" value={formatNumber(data?.openSessions)} icon={Clock} />
          <Stat label="Ledger Entries" value={formatNumber(data?.totalLedgerEntries)} icon={Database} />
          <Stat label="Pending Withdrawals" value={formatNumber(data?.pendingWithdrawals)} icon={Wallet} tone={data?.pendingWithdrawals ? "sell" : undefined} />
        </div>

        <div className="grid lg:grid-cols-3 gap-5">
          <section className="lg:col-span-2 glass rounded-xl overflow-hidden">
            <SectionHeader icon={BarChart3} title="Top Users By Confirmed Ledger Volume" />
            <div className="overflow-x-auto scrollbar-none">
              <table className="w-full text-sm min-w-[720px]">
                <thead className="text-[11px] text-muted-foreground uppercase">
                  <tr className="border-b border-border/50">
                    <th className="text-left px-4 py-2">User</th>
                    <th className="text-left">Wallet</th>
                    <th className="text-right">Entries</th>
                    <th className="text-right">Volume Raw</th>
                    <th className="text-right pr-4">Last Login</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.topUsers ?? []).map((user) => (
                    <tr key={user.userId} className="border-b border-border/30 hover:bg-muted/20">
                      <td className="px-4 py-3 font-semibold">{user.userId}<div className="text-[10px] text-muted-foreground">{user.walletType}</div></td>
                      <td className="font-mono text-xs">{shortAddress(user.walletAddress)}</td>
                      <td className="text-right font-mono">{user.entryCount}</td>
                      <td className="text-right font-mono">{formatCompactRaw(user.totalRaw)}</td>
                      <td className="text-right pr-4 text-xs text-muted-foreground">{formatDate(user.lastLoginAt)}</td>
                    </tr>
                  ))}
                  {!loading && data?.topUsers?.length === 0 && <EmptyRow colSpan={5} />}
                </tbody>
              </table>
            </div>
          </section>

          <section className="glass rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold flex items-center gap-2"><Landmark className="h-4 w-4 text-primary" /> Token Balances</h2>
              <span className="text-[10px] text-muted-foreground">Raw total {formatCompactRaw(String(balanceTotal))}</span>
            </div>
            <div className="space-y-2.5">
              {(data?.totalBalances ?? []).map((item) => (
                <div key={item.token} className="glass rounded-lg p-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold">{item.token}</span>
                    <span className="font-mono">{formatCompactRaw(item.amount)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                    <div className="h-full rounded-full bg-primary/80" style={{ width: `${barWidth(item.amount, balanceTotal)}%` }} />
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">Locked: {formatCompactRaw(item.locked)}</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
          <section className="glass rounded-xl overflow-hidden">
            <SectionHeader icon={Database} title="Recent Ledger Activity" />
            <div className="overflow-x-auto scrollbar-none">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="text-[11px] text-muted-foreground uppercase">
                  <tr className="border-b border-border/50">
                    <th className="text-left px-4 py-2">Type</th>
                    <th className="text-left">User</th>
                    <th className="text-right">Amount</th>
                    <th className="text-right">Status</th>
                    <th className="text-right pr-4">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.recentLedgerEntries ?? []).map((entry) => (
                    <tr key={entry.id} className="border-b border-border/30 hover:bg-muted/20">
                      <td className="px-4 py-3"><span className="font-medium">{entry.kind}</span><div className="text-[10px] text-muted-foreground">{entry.token}</div></td>
                      <td className="font-mono text-xs">{entry.userId}</td>
                      <td className="text-right font-mono">{formatCompactRaw(entry.amount)}</td>
                      <td className="text-right"><StatusBadge status={entry.status} /></td>
                      <td className="text-right pr-4 text-xs text-muted-foreground">{formatDate(entry.createdAt)}</td>
                    </tr>
                  ))}
                  {!loading && data?.recentLedgerEntries?.length === 0 && <EmptyRow colSpan={5} />}
                </tbody>
              </table>
            </div>
          </section>

          <section className="glass rounded-xl overflow-hidden">
            <SectionHeader icon={Users} title="Newest Users" />
            <div className="overflow-x-auto scrollbar-none">
              <table className="w-full text-sm min-w-[560px]">
                <thead className="text-[11px] text-muted-foreground uppercase">
                  <tr className="border-b border-border/50">
                    <th className="text-left px-4 py-2">User</th>
                    <th className="text-left">Wallet</th>
                    <th className="text-right">Created</th>
                    <th className="text-right pr-4">Last Login</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.recentUsers ?? []).map((user) => (
                    <tr key={user.id} className="border-b border-border/30 hover:bg-muted/20">
                      <td className="px-4 py-3 font-semibold">{user.id}<div className="text-[10px] text-muted-foreground">{user.walletType}</div></td>
                      <td className="font-mono text-xs">{shortAddress(user.walletAddress)}</td>
                      <td className="text-right text-xs text-muted-foreground">{formatDate(user.createdAt)}</td>
                      <td className="text-right pr-4 text-xs text-muted-foreground">{formatDate(user.lastLoginAt)}</td>
                    </tr>
                  ))}
                  {!loading && data?.recentUsers?.length === 0 && <EmptyRow colSpan={4} />}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </AdminLayout>
  );
}

function P2PPriceCard() {
  const [price,setPrice]=useState("");
  const [priceDate,setPriceDate]=useState("");
  const [message,setMessage]=useState("");
  const [saving,setSaving]=useState(false);

  useEffect(()=>{
    getAdminP2PPrice().then(result=>{
      setPrice(result.price.price);
      setPriceDate(result.price.priceDate);
    }).catch(()=>setMessage("No P2P price has been entered for today. Trading is disabled."));
  },[]);

  async function save(){
    if(!/^\d+(\.\d{1,8})?$/.test(price)||Number(price)<=0){
      setMessage("Enter a positive INR price with up to 8 decimal places.");
      return;
    }
    try{
      setSaving(true);
      setMessage("");
      const result=await setAdminP2PPrice(price);
      setPrice(result.price.price);
      setPriceDate(result.price.priceDate);
      setMessage("Today's P2P price was saved.");
    }catch(e){
      setMessage(e instanceof Error?e.message:"Could not save P2P price.");
    }finally{
      setSaving(false);
    }
  }

  return <section className="glass rounded-xl p-4">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="font-semibold flex items-center gap-2"><Landmark className="h-4 w-4 text-primary"/>P2P Daily Price</h2>
        <p className="mt-1 text-xs text-muted-foreground">USDC / INR for {priceDate||"today"}. Posting and buying stay disabled until this is set.</p>
      </div>
      <div className="flex w-full gap-2 sm:w-auto">
        <Input aria-label="P2P USDC INR price" type="number" min="0" step="0.00000001" value={price} onChange={event=>setPrice(event.target.value)} placeholder="INR per USDC" className="sm:w-56"/>
        <Button onClick={()=>void save()} disabled={saving}>{saving?"Saving…":"Save price"}</Button>
      </div>
    </div>
    {message&&<p className="mt-3 text-xs text-muted-foreground">{message}</p>}
  </section>;
}

function P2PAppealsCard() {
  const [orders,setOrders]=useState<P2POrder[]>([]);
  const [message,setMessage]=useState("");
  const [acting,setActing]=useState("");

  const load=async()=>{
    try{
      setOrders((await getAdminP2PAppeals()).orders);
    }catch(e){
      setMessage(e instanceof Error?e.message:"Could not load P2P appeals.");
    }
  };

  useEffect(()=>{void load()},[]);

  async function resolve(order:P2POrder,action:"release"|"cancel"){
    try{
      setActing(order.id);
      setMessage("");
      await resolveAdminP2PAppeal(order.id,action);
      await load();
      setMessage(`Appeal ${order.id} was resolved: ${action}.`);
    }catch(e){
      setMessage(e instanceof Error?e.message:"Could not resolve appeal.");
    }finally{
      setActing("");
    }
  }

  return <section className="glass rounded-xl overflow-hidden">
    <SectionHeader icon={Clock} title="P2P Appeals" />
    {message&&<p className="px-4 pt-3 text-xs text-muted-foreground">{message}</p>}
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="border-b border-border/50 text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-2 text-left">Order</th><th className="text-left">Buyer / Seller</th><th className="text-right">USDC</th><th className="text-right">Buyer paid</th><th className="px-4 text-right">Resolution</th></tr></thead>
        <tbody>{orders.map(order=><tr key={order.id} className="border-b border-border/30">
          <td className="px-4 py-3 font-mono text-xs">{order.id}</td>
          <td><p>{order.buyerId}</p><p className="text-xs text-muted-foreground">{order.sellerId}</p></td>
          <td className="text-right">{formatUSDC(order.amountRaw)}</td>
          <td className="text-right">{formatINR(order.buyerPayable)}</td>
          <td className="px-4 text-right"><div className="flex justify-end gap-2"><Button size="sm" disabled={!!acting} onClick={()=>void resolve(order,"release")}>Release USDC</Button><Button size="sm" variant="outline" disabled={!!acting} onClick={()=>void resolve(order,"cancel")}>Cancel & refund</Button></div></td>
        </tr>)}{orders.length===0&&<EmptyRow colSpan={5}/>}</tbody>
      </table>
    </div>
  </section>;
}

function Stat({ label, value, icon: Icon, tone }: { label: string; value: string; icon: any; tone?: "buy" | "sell" }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</span>
        <div className="h-7 w-7 rounded-lg bg-muted/30 flex items-center justify-center">
          <Icon className={cn("h-3.5 w-3.5 text-primary", tone === "buy" && "text-buy", tone === "sell" && "text-sell")} />
        </div>
      </div>
      <div className={cn("text-2xl font-bold font-mono", tone === "buy" && "text-buy", tone === "sell" && "text-sell")}>{value}</div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
      <h2 className="font-semibold flex items-center gap-2"><Icon className="h-4 w-4 text-primary" /> {title}</h2>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const good = status === "confirmed";
  const pending = status === "pending" || status === "processing";
  return <Badge variant="outline" className={cn("text-[10px]", good && "border-buy/30 text-buy", pending && "border-warning/30 text-warning", !good && !pending && "border-sell/30 text-sell")}>{status}</Badge>;
}

function EmptyRow({ colSpan }: { colSpan: number }) {
  return <tr><td colSpan={colSpan} className="px-4 py-8 text-center text-sm text-muted-foreground">No database records yet.</td></tr>;
}

function formatNumber(value?: number) {
  return (value ?? 0).toLocaleString();
}

function formatCompactRaw(value?: string) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return value ?? "0";
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n.toLocaleString();
}

function formatDate(value?: string) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

function shortAddress(value: string) {
  if (!value || value.length < 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function barWidth(amount: string, total: number) {
  const n = Number(amount || 0);
  if (!total || !Number.isFinite(n)) return 0;
  return Math.max(4, Math.min(100, (n / total) * 100));
}
