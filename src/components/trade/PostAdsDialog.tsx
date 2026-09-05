import { useEffect,useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog,DialogContent,DialogHeader,DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createP2PListing,parseUSDBAmount,P2P_PAYMENT_METHODS,type P2PAdSide,type P2PListing,type P2PPaymentMethod } from "@/lib/p2pApi";

type Props={open:boolean;onOpenChange:(open:boolean)=>void;side:P2PAdSide;username:string;onUsernameEstablished:(username:string)=>void;onCreated:(listing:P2PListing)=>void};

export function PostAdsDialog({open,onOpenChange,side,username,onUsernameEstablished,onCreated}:Props){
	const [amount,setAmount]=useState("0.00");
	const [name,setName]=useState("");
	const [methods,setMethods]=useState<P2PPaymentMethod[]>(["UPI"]);
	const [submitting,setSubmitting]=useState(false);
	const [error,setError]=useState("");

	useEffect(()=>{if(open){setAmount("0.00");setName(username);setMethods(["UPI"]);setError("")}},[open,side,username]);
	function toggleMethod(method:P2PPaymentMethod){setMethods(current=>current.includes(method)?current.filter(item=>item!==method):[...current,method])}
	function updateAmount(value:string){if(/^\d*(?:\.\d{0,2})?$/.test(value))setAmount(value)}
	function normalizeAmount(){const value=Number(amount);setAmount(Number.isFinite(value)&&value>=0?value.toFixed(2):"0.00")}
	async function submit(){
		try{
			setSubmitting(true);setError("");
			if(methods.length===0)throw new Error("Select at least one payment method");
			const {listing}=await createP2PListing(side,parseUSDBAmount(amount),methods,username?undefined:name.trim());
			if(!username)onUsernameEstablished(name.trim());
			onCreated(listing);onOpenChange(false);
		}catch(e){setError(e instanceof Error?e.message:"Could not post ad")}finally{setSubmitting(false)}
	}

	return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Post {side==="BUY"?"Buy":"Sell"} USDB ad</DialogTitle></DialogHeader><div className="space-y-5">
		{username?<div className="rounded-lg border bg-muted/30 p-4 text-sm"><span className="text-muted-foreground">P2P username</span><strong className="float-right">{username}</strong></div>:<div className="space-y-2"><label className="text-sm font-medium">Choose your permanent P2P username</label><Input value={name} maxLength={24} onChange={event=>setName(event.target.value.replace(/[^A-Za-z0-9_]/g,""))} placeholder="3-24 letters, numbers, or underscores"/><p className="text-xs text-muted-foreground">This username is permanent and cannot be changed later.</p></div>}
		<div className="space-y-2"><label className="text-sm font-medium">USDB amount to {side==="BUY"?"buy":"sell"}</label><div className="flex gap-2"><Input inputMode="decimal" value={amount} onChange={event=>updateAmount(event.target.value)} onBlur={normalizeAmount}/><span className="flex items-center rounded-md bg-muted/30 px-3">USDB</span></div><p className="text-xs text-muted-foreground">Amounts are shown as XX.XX USDB.</p></div>
		<div className="space-y-3"><label className="text-sm font-medium">Payment methods</label><div className="grid grid-cols-1 gap-2 rounded-lg border p-4 sm:grid-cols-2">{P2P_PAYMENT_METHODS.map(method=><label key={method} className="flex cursor-pointer items-center gap-2 text-sm"><Checkbox checked={methods.includes(method)} onCheckedChange={()=>toggleMethod(method)}/><span>{method}</span></label>)}</div><p className="text-xs text-muted-foreground">Select one, multiple, or all methods visible to the counterparty.</p></div>
		{side==="SELL"&&<p className="text-xs text-muted-foreground">Posting a sell ad reserves this amount from your P2P wallet. Transfer funds separately before posting.</p>}
		{error&&<p className="text-sm text-destructive">{error}</p>}<div className="flex gap-3"><Button className="flex-1" disabled={submitting||methods.length===0||(!username&&name.length<3)} onClick={submit}>{submitting?"Posting…":`Post ${side==="BUY"?"Buy":"Sell"} Ad`}</Button><Button variant="outline" onClick={()=>onOpenChange(false)}>Cancel</Button></div>
	</div></DialogContent></Dialog>;
}
