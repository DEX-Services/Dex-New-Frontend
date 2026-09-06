import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, WalletCards } from "lucide-react";
import { Link } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  formatUSDBAmount,
  formatUSDBSellCapacity,
  fundP2PWallet,
  getP2PPaymentAccounts,
  getP2PWallet,
  parseUSDBAmount,
  P2P_PAYMENT_METHODS,
  saveP2PPaymentAccount,
  type P2PPaymentAccount,
  type P2PPaymentMethod,
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
  const [accounts, setAccounts] = useState<P2PPaymentAccount[]>([]);
  const [method, setMethod] = useState<P2PPaymentMethod>("UPI");
  const [accountName, setAccountName] = useState("");
  const [accountIdentifier, setAccountIdentifier] = useState("");
  const [instructions, setInstructions] = useState("");
  const [savingAccount, setSavingAccount] = useState(false);

  const regularAvailable = useMemo(
    () => balances.find((balance) => balance.asset === "USDB")?.available ?? 0,
    [balances],
  );

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const [response, paymentAccounts] = await Promise.all([getP2PWallet(), getP2PPaymentAccounts()]);
      setP2PBalance(response.balance ?? response.balances?.[0] ?? emptyBalance);
      setAccounts(paymentAccounts.accounts);
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

  async function saveAccount() {
    try {
      setSavingAccount(true);
      setError("");
      await saveP2PPaymentAccount(method, accountName, accountIdentifier, instructions);
      setSuccess(`${method} payment details saved.`);
      setAccountName("");
      setAccountIdentifier("");
      setInstructions("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save payment details");
    } finally {
      setSavingAccount(false);
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
              <Kpi label="Available for Sale" value={`${formatUSDBSellCapacity(p2pBalance.availableRaw)} USDB`} />
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

            <Card className="border-border/50 bg-card/30 p-6">
              <div className="mb-6"><h2 className="text-lg font-semibold">Payment Accounts</h2><p className="text-sm text-muted-foreground">These details are shown only to the buyer after an order is created.</p></div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  <Select value={method} onValueChange={(value) => setMethod(value as P2PPaymentMethod)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{P2P_PAYMENT_METHODS.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
                  <Input value={accountName} onChange={event => setAccountName(event.target.value)} placeholder="Account holder name" maxLength={100} />
                  <Input value={accountIdentifier} onChange={event => setAccountIdentifier(event.target.value)} placeholder={method === "UPI" ? "UPI ID" : "Account number or payment identifier"} maxLength={200} />
                  <Input value={instructions} onChange={event => setInstructions(event.target.value)} placeholder="Optional payment instructions" maxLength={500} />
                  <Button disabled={savingAccount || accountName.trim().length < 2 || accountIdentifier.trim().length < 2} onClick={() => void saveAccount()}>{savingAccount ? "Saving…" : "Save Payment Method"}</Button>
                </div>
                <div className="space-y-2">{accounts.length === 0 ? <p className="rounded-lg border p-4 text-sm text-muted-foreground">No payment methods configured yet.</p> : accounts.map(account => <div key={account.id} className="rounded-lg border p-4"><div className="flex justify-between gap-3"><span className="font-semibold">{account.method}</span><span className="text-sm text-muted-foreground">{account.accountName}</span></div><p className="mt-2 break-all font-mono text-sm">{account.accountIdentifier}</p>{account.instructions && <p className="mt-2 text-xs text-muted-foreground">{account.instructions}</p>}</div>)}</div>
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
