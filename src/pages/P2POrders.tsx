import { useCallback,useEffect,useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft,Clock } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	appealP2POrder,
	cancelP2POrder,
	formatINR,
	formatUSDC,
	getP2POrders,
	markP2POrderPaid,
	releaseP2POrder,
	type P2POrder,
} from "@/lib/p2pApi";
import { wallet,useWallet } from "@/lib/useWallet";

const statusLabel:Record<P2POrder["status"],string>={
	pending_payment:"Awaiting payment",
	payment_made:"Buyer marked paid",
	completed:"Completed",
	cancelled:"Cancelled",
	appeal:"Under appeal",
};

export default function P2POrders(){
	const {userId}=useWallet();
	const [orders,setOrders]=useState<P2POrder[]>([]);
	const [error,setError]=useState("");
	const [loading,setLoading]=useState(false);
	const [acting,setActing]=useState("");
	const [,setClock]=useState(0);

	const load=useCallback(async()=>{
		if(!userId)return;
		try{
			setLoading(true);
			setError("");
			setOrders((await getP2POrders()).orders);
		}catch(e){
			setError(e instanceof Error?e.message:"Could not load orders");
		}finally{
			setLoading(false);
		}
	},[userId]);

	useEffect(()=>{void load()},[load]);
	useEffect(()=>{const timer=window.setInterval(()=>setClock(value=>value+1),1000);return()=>window.clearInterval(timer)},[]);

	async function run(order:P2POrder,name:string,fn:(id:string)=>Promise<{order:P2POrder}>){
		try{
			setActing(`${order.id}:${name}`);
			setError("");
			await fn(order.id);
			await Promise.all([load(),wallet.refreshBalances()]);
		}catch(e){
			setError(e instanceof Error?e.message:"Could not update order");
		}finally{
			setActing("");
		}
	}

	return <AppShell><main className="mx-auto min-h-screen max-w-6xl space-y-6 p-6">
		<div>
			<Link to="/p2p" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4"/>Back to P2P</Link>
			<h1 className="mt-4 text-3xl font-bold">My P2P orders</h1>
			<p className="mt-1 text-sm text-muted-foreground">USDC remains reserved until the buyer marks payment and the seller releases it.</p>
		</div>
		{error&&<Card className="border-destructive/30 bg-destructive/10 p-4 text-destructive">{error}</Card>}
		{!userId?<Card className="p-8 text-center text-muted-foreground">Connect and authenticate a wallet to view your orders.</Card>:
		<Card className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[980px] text-sm">
			<thead className="border-b bg-muted/30 text-left text-xs uppercase text-muted-foreground"><tr>
				<th className="p-4">Order</th><th className="p-4">Side</th><th className="p-4">USDC</th><th className="p-4">Payment</th><th className="p-4">Total / Receivable</th><th className="p-4">Status</th><th className="p-4 text-right">Action</th>
			</tr></thead>
			<tbody>
			{loading&&orders.length===0?<tr><td colSpan={7} className="p-8 text-center">Loading…</td></tr>:
			orders.length===0?<tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No P2P orders found.</td></tr>:
			orders.map(order=>{
				const buyer=order.buyerId===userId;
				const pending=order.status==="pending_payment";
				const paid=order.status==="payment_made";
				return <tr className="border-b align-top last:border-0" key={order.id}>
					<td className="p-4"><p className="font-mono text-xs">{order.id}</p><p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleString()}</p></td>
					<td className="p-4 font-semibold">{buyer?"BUY":"SELL"}</td>
					<td className="p-4">{formatUSDC(order.amountRaw)} USDC</td>
					<td className="p-4"><p>{order.paymentMethod}</p>{buyer&&pending&&<p className="mt-1 text-xs text-muted-foreground">Pay the seller outside DEX.ai, then mark paid.</p>}</td>
					<td className="p-4">{formatINR(buyer?order.buyerPayable:order.sellerReceivable)}</td>
					<td className="p-4"><p className={order.status==="completed"?"font-medium text-green-600":order.status==="cancelled"?"text-destructive":"font-medium text-amber-500"}>{statusLabel[order.status]}</p>{pending&&<p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3"/>{remaining(order.expiresAt)}</p>}{order.cancellationReason&&<p className="mt-1 text-xs text-muted-foreground">{order.cancellationReason}</p>}</td>
					<td className="p-4"><div className="flex justify-end gap-2">
						{buyer&&pending&&<><Button size="sm" disabled={!!acting} onClick={()=>void run(order,"paid",markP2POrderPaid)}>I have paid</Button><Button size="sm" variant="outline" disabled={!!acting} onClick={()=>void run(order,"cancel",cancelP2POrder)}>Cancel</Button></>}
						{!buyer&&paid&&<Button size="sm" className="bg-green-600 text-white hover:bg-green-700" disabled={!!acting} onClick={()=>void run(order,"release",releaseP2POrder)}>Confirm & release</Button>}
						{paid&&<Button size="sm" variant="outline" disabled={!!acting} onClick={()=>void run(order,"appeal",appealP2POrder)}>Appeal</Button>}
					</div></td>
				</tr>
			})}
			</tbody>
		</table></div></Card>}
	</main></AppShell>;
}

function remaining(expiresAt:string){
	const seconds=Math.max(0,Math.floor((new Date(expiresAt).getTime()-Date.now())/1000));
	if(seconds===0)return "Expiring…";
	return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,"0")} remaining`;
}
