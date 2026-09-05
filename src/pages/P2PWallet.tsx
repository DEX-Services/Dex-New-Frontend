import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, WalletCards } from "lucide-react";
import { Link } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  formatUSDBAmount,
  fundP2PWallet,
  getP2PWallet,
  parseUSDBAmount,
  type P2PWalletBalance,
} from "@/lib/p2pApi";
import { useWallet, wallet } from "@/lib/useWallet";

const emptyBalance: P2PWalletBalance = {
  asset: "USDB",
  availableRaw: "0",
  reservedRaw: "0",
  totalRaw: "0",
};

export default function P2PWallet() {
  const { userId, balances } = useWallet();
  const [p2pBalance, setP2PBalance] = useState<P2PWalletBalance>(emptyBalance);
  const [amount, setAmount] = useState("0.00");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const regularAvailable = useMemo(
    () => balances.find((balance) => balance.asset === "USDB")?.available ?? 0,
    [balances],
  );

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const response = await getP2PWallet();
      setP2PBalance(response.balance ?? response.balances?.[0] ?? emptyBalance);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load P2P wallet");
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function transfer() {
    const displayedAmount = Number(amount).toFixed(2);
    try {
      setLoading(true);
      setError("");
      setSuccess("");
      const response = await fundP2PWallet("USDB", parseUSDBAmount(amount));
      setP2PBalance(response.balance);
      setSuccess(`${displayedAmount} USDB transferred to your P2P wallet.`);
      setAmount("0.00");
      try {
        await wallet.refreshBalances();
      } catch {
        setError("Transfer succeeded, but the Balance Wallet display could not be refreshed yet.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not transfer USDB");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <main className="mx-auto min-h-screen max-w-5xl space-y-6 p-6">
        <div>
          <Link to="/p2p" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> Back to Marketplace
          </Link>
          <h1 className="mt-4 text-3xl font-bold">P2P Wallet</h1>
          <p className="text-muted-foreground">Move USDB from your Balance Wallet before using it for P2P selling.</p>
        </div>

        {!userId ? (
          <Card className="p-8 text-center text-muted-foreground">Connect and authenticate a wallet to view your P2P wallet.</Card>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi label="Balance Wallet" value={`${regularAvailable.toFixed(2)} USDB`} />
              <Kpi label="P2P Wallet Balance" value={`${formatUSDBAmount(p2pBalance.totalRaw)} USDB`} />
              <Kpi label="Available for Sale" value={`${formatUSDBAmount(p2pBalance.availableRaw)} USDB`} />
              <Kpi label="Reserved in Ads" value={`${formatUSDBAmount(p2pBalance.reservedRaw)} USDB`} />
            </div>

            <Card className="border-border/50 bg-card/30 p-6">
              <div className="mb-6 flex items-start gap-3">
                <div className="rounded-lg bg-primary/10 p-2 text-primary"><WalletCards className="h-5 w-5" /></div>
                <div>
                  <h2 className="text-lg font-semibold">Transfer to P2P Wallet</h2>
                  <p className="text-sm text-muted-foreground">Balance/User Wallet → P2P Wallet</p>
                </div>
              </div>
              <div className="max-w-xl space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium">USDB amount</label>
                  <div className="relative">
                    <Input
                      inputMode="decimal"
                      value={amount}
                      onChange={(event) => /^\d*(?:\.\d{0,2})?$/.test(event.target.value) && setAmount(event.target.value)}
                      onBlur={() => setAmount((Number(amount) || 0).toFixed(2))}
                      className="pr-20"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold">USDB</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Available in Balance Wallet: {regularAvailable.toFixed(2)} USDB</p>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                {success && <p className="text-sm text-buy">{success}</p>}
                <Button disabled={loading || Number(amount) <= 0 || Number(amount) > regularAvailable} onClick={() => void transfer()}>
                  {loading ? "Transferring…" : "Transfer to P2P Wallet"}<ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </Card>
          </>
        )}
      </main>
    </AppShell>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return <Card className="border-border/50 bg-card/30 p-5"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-lg font-semibold">{value}</p></Card>;
}
