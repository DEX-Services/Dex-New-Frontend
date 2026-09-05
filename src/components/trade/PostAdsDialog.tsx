import { useEffect,useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog,DialogContent,DialogHeader,DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/components/ui/select";
import { createP2PListing,formatINR,formatP2PAmount,fundP2PWallet,parseP2PAmount,P2P_PAYMENT_METHODS,type P2PAsset,type P2PListing,type P2PPaymentMethod,type P2PWalletBalance } from "@/lib/p2pApi";

type Props={
	open:boolean;
	onOpenChange:(open:boolean)=>void;
	asset:P2PAsset;
	price:string;
	mainAvailable:number;
	p2pBalance:P2PWalletBalance;
	initialAmount?:string;
	initialPayment?:P2PPaymentMethod;
	onFunded:(balance:P2PWalletBalance)=>void;
	onCreated:(listing:P2PListing)=>void;
};

export function PostAdsDialog({open,onOpenChange,asset,price,mainAvailable,p2pBalance,initialAmount="",initialPayment="UPI",onFunded,onCreated}:Props){
	const [amount,setAmount]=useState("");
	const [fundAmount,setFundAmount]=useState("");
	const [method,setMethod]=useState<P2PPaymentMethod>("UPI");
	const [submitting,setSubmitting]=useState(false);
	const [funding,setFunding]=useState(false);
	const [error,setError]=useState("");

	useEffect(()=>{if(open){setAmount(initialAmount);setFundAmount("");setMethod(initialPayment);setError("")}},[open,asset,initialAmount,initialPayment]);

	const p2pAvailable=Number(formatP2PAmount(p2pBalance.availableRaw));
	const p2pReserved=Number(formatP2PAmount(p2pBalance.reservedRaw));
	const p2pTotal=Number(formatP2PAmount(p2pBalance.totalRaw));
	const gross=Number(amount||0)*Number(price||0);
	const valid=Number(amount)>0&&Number(amount)<=p2pAvailable;
	const canFund=Number(fundAmount)>0&&Number(fundAmount)<=mainAvailable;

	async function fund(){
		try{
			setFunding(true);setError("");
			const {balance}=await fundP2PWallet(asset,parseP2PAmount(fundAmount,asset));
			onFunded(balance);setFundAmount("");
		}catch(e){setError(e instanceof Error?e.message:"Could not fund P2P wallet")}finally{setFunding(false)}
	}

	async function submit(){
		try{
			setSubmitting(true);setError("");
			const {listing}=await createP2PListing(asset,parseP2PAmount(amount,asset),method);
			onCreated(listing);onOpenChange(false);
		}catch(e){setError(e instanceof Error?e.message:"Could not post ad")}finally{setSubmitting(false)}
	}

	return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Post {asset} sell ad</DialogTitle></DialogHeader><div className="space-y-5">
		<div className="rounded-lg border bg-muted/30 p-4 text-sm"><BalanceRow label="Today’s database price" value={`${formatINR(price)} / ${asset}`}/><BalanceRow label="P2P wallet total" value={`${p2pTotal.toLocaleString()} ${asset}`}/><BalanceRow label="Reserved / pending" value={`${p2pReserved.toLocaleString()} ${asset}`}/><BalanceRow label="Available to sell" value={`${p2pAvailable.toLocaleString()} ${asset}`}/></div>
		<div className="rounded-lg border p-4"><div className="mb-2 flex items-center justify-between text-sm"><span className="font-medium">Transfer from main wallet</span><span className="text-muted-foreground">Available {mainAvailable.toLocaleString()} {asset}</span></div><div className="flex gap-2"><Input type="number" min="0" step="0.000001" value={fundAmount} onChange={e=>setFundAmount(e.target.value)} placeholder={`Amount of ${asset}`}/><Button type="button" variant="outline" disabled={!canFund||funding} onClick={fund}>{funding?"Transferring…":"Transfer to P2P"}</Button></div><p className="mt-2 text-xs text-muted-foreground">Sell ads use the separate P2P wallet, not your main wallet balance.</p></div>
		<div className="space-y-2"><label className="text-sm font-medium">{asset} amount to sell</label><Input type="number" min="0" step="0.000001" value={amount} onChange={e=>setAmount(e.target.value)} placeholder={`Enter ${asset} amount`}/></div>
		<div className="space-y-2"><label className="text-sm font-medium">Payment method</label><Select value={method} onValueChange={v=>setMethod(v as P2PPaymentMethod)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{P2P_PAYMENT_METHODS.map(item=><SelectItem value={item} key={item}>{item}</SelectItem>)}</SelectContent></Select></div>
		<div className="rounded-lg border p-4 text-sm"><BalanceRow label="Gross sale value" value={formatINR(gross)}/><BalanceRow label="Seller fee (1%)" value={formatINR(gross*.01)}/><BalanceRow label="You receive" value={formatINR(gross*.99)} strong/></div>
		{Number(amount)>p2pAvailable&&<p className="text-sm text-destructive">Only {p2pAvailable.toLocaleString()} {asset} is currently available in your P2P wallet.</p>}{error&&<p className="text-sm text-destructive">{error}</p>}<div className="flex gap-3"><Button className="flex-1" disabled={!valid||submitting||funding} onClick={submit}>{submitting?"Posting…":"Post sell ad"}</Button><Button variant="outline" onClick={()=>onOpenChange(false)}>Cancel</Button></div>
	</div></DialogContent></Dialog>;
}

function BalanceRow({label,value,strong=false}:{label:string;value:string;strong?:boolean}){return <div className={`flex justify-between gap-4 py-1 ${strong?"font-semibold":""}`}><span>{label}</span><strong>{value}</strong></div>}
