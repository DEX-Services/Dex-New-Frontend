import { useCallback,useEffect,useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cancelP2POrder,formatINR,formatP2PAmount,getP2POrders,markP2POrderPaid,releaseP2POrder,type P2POrder } from "@/lib/p2pApi";
import { useWallet } from "@/lib/useWallet";

const statusLabel:Record<P2POrder["status"],string>={pending_payment:"Awaiting payment",payment_made:"Payment marked paid",completed:"Completed",cancelled:"Cancelled",appeal:"In appeal"};

export default function P2POrders(){
	const {userId}=useWallet();
	const [orders,setOrders]=useState<P2POrder[]>([]);
	const [error,setError]=useState("");
	const [loading,setLoading]=useState(false);
	const [acting,setActing]=useState("");

	const load=useCallback(async()=>{
		if(!userId)return;
		try{setLoading(true);setError("");setOrders((await getP2POrders()).orders)}catch(e){setError(e instanceof Error?e.message:"Could not load orders")}finally{setLoading(false)}
	},[userId]);
	useEffect(()=>{void load()},[load]);

	async function act(key:string,action:()=>Promise<unknown>){
		try{setActing(key);setError("");await action();await load()}catch(e){setError(e instanceof Error?e.message:"Could not update order")}finally{setActing("")}
	}

	return <AppShell><main className="mx-auto min-h-screen max-w-7xl space-y-6 p-6"><div><Link to="/p2p" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4"/>Back to P2P</Link><h1 className="mt-4 text-3xl font-bold">My P2P orders</h1><p className="text-muted-foreground">Buyers mark external payment as paid; sellers release the escrow after confirming receipt.</p></div>{!userId?<Card className="p-8 text-center text-muted-foreground">Connect and authenticate a wallet to view your orders.</Card>:<>{error&&<Card className="p-4 text-destructive">{error}</Card>}<Card className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-sm"><thead className="border-b bg-muted/30 text-left text-xs uppercase text-muted-foreground"><tr><th className="p-4">Order</th><th className="p-4">Side</th><th className="p-4">Asset</th><th className="p-4">Payment</th><th className="p-4">Total / Receivable</th><th className="p-4">Status</th><th className="p-4 text-right">Action</th></tr></thead><tbody>{loading?<tr><td colSpan={7} className="p-8 text-center">Loading…</td></tr>:orders.length===0?<tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No P2P orders found.</td></tr>:orders.map(order=>{const bought=order.buyerId===userId;const pending=order.status==="pending_payment";const paid=order.status==="payment_made";return <tr className="border-b last:border-0" key={order.id}><td className="p-4"><p className="font-mono text-xs">{order.id}</p><p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleString()}</p></td><td className="p-4 font-semibold">{bought?"BUY":"SELL"}</td><td className="p-4">{formatP2PAmount(order.amountRaw)} {order.asset}</td><td className="p-4">{order.paymentMethod}</td><td className="p-4">{formatINR(bought?order.buyerPayable:order.sellerReceivable)}</td><td className="p-4"><span className={order.status==="completed"?"text-green-600":order.status==="cancelled"?"text-destructive":"text-amber-500"}>{statusLabel[order.status]}</span>{order.cancellationReason&&<p className="text-xs text-muted-foreground">{order.cancellationReason}</p>}</td><td className="p-4"><div className="flex justify-end gap-2">{bought&&pending&&<><Button size="sm" disabled={!!acting} onClick={()=>void act(`${order.id}:paid`,()=>markP2POrderPaid(order.id))}>{acting===`${order.id}:paid`?"Updating…":"I have paid"}</Button><Button size="sm" variant="outline" disabled={!!acting} onClick={()=>void act(`${order.id}:cancel`,()=>cancelP2POrder(order.id))}>Cancel</Button></>}{!bought&&paid&&<Button size="sm" disabled={!!acting} onClick={()=>void act(`${order.id}:release`,()=>releaseP2POrder(order.id))}>{acting===`${order.id}:release`?"Releasing…":`Release ${order.asset}`}</Button>}{bought&&paid&&<span className="text-xs text-muted-foreground">Waiting for seller release</span>}</div></td></tr>})}</tbody></table></div></Card></>}</main></AppShell>;
}
