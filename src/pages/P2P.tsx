import { useCallback,useEffect,useMemo,useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { PostAdsDialog } from "@/components/trade/PostAdsDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog,DialogContent,DialogHeader,DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/components/ui/select";
import { ArrowRight,ChevronDown,ClipboardList,Clock,Filter,Lock,MoreHorizontal,Search,Shield,TrendingUp,Users } from "lucide-react";
import { shortAddress,wallet,useWallet } from "@/lib/useWallet";
import { buyP2PListing,formatINR,formatP2PAmount,getP2PListings,getP2PPrice,getP2PWallet,parseP2PAmount,P2P_ASSETS,P2P_PAYMENT_METHODS,type P2PAsset,type P2PListing,type P2POrder,type P2PWalletBalance } from "@/lib/p2pApi";

const emptyBalance=(asset:P2PAsset):P2PWalletBalance=>({asset,availableRaw:"0",reservedRaw:"0",totalRaw:"0"});
const errorMessage=(error:unknown)=>error instanceof Error?error.message:"Something went wrong";

export default function P2P(){
	const account=useWallet();
	const [mode,setMode]=useState<"buy"|"sell">("buy");
	const [asset,setAsset]=useState<P2PAsset>("USDB");
	const [price,setPrice]=useState("");
	const [priceDate,setPriceDate]=useState("");
	const [listings,setListings]=useState<P2PListing[]>([]);
	const [p2pBalances,setP2PBalances]=useState<P2PWalletBalance[]>(P2P_ASSETS.map(emptyBalance));
	const [loading,setLoading]=useState(true);
	const [error,setError]=useState("");
	const [payment,setPayment]=useState("All");
	const [amount,setAmount]=useState("");
	const [bankOption,setBankOption]=useState("UPI");
	const [postOpen,setPostOpen]=useState(false);
	const [selected,setSelected]=useState<P2PListing|null>(null);
	const [quantity,setQuantity]=useState("");
	const [buying,setBuying]=useState(false);
	const [order,setOrder]=useState<P2POrder|null>(null);

	const mainBalance=account.balances.find(balance=>balance.asset===asset);
	const p2pBalance=p2pBalances.find(balance=>balance.asset===asset)??emptyBalance(asset);

	const loadMarket=useCallback(async()=>{
		try{
			setLoading(true);setError("");
			const [{price:today},{listings:ads}]=await Promise.all([getP2PPrice(asset),getP2PListings()]);
			if(today.asset!==asset){
				setPrice("");setPriceDate("");setListings(ads);
				setError(`The backend is still running the older ${today.asset}-only P2P version. Restart the backend to enable ${asset}.`);
				return;
			}
			setPrice(today.price);setPriceDate(today.priceDate);setListings(ads);
		}catch(e){setError(errorMessage(e))}finally{setLoading(false)}
	},[asset]);

	const loadP2PWallet=useCallback(async()=>{
		if(!account.userId){setP2PBalances(P2P_ASSETS.map(emptyBalance));return}
		try{
			const response=await getP2PWallet();
			const returned=Array.isArray(response.balances)?response.balances:response.balance?[response.balance]:[];
			setP2PBalances(P2P_ASSETS.map(assetName=>returned.find(balance=>balance.asset===assetName)??emptyBalance(assetName)));
		}catch(e){setError(errorMessage(e))}
	},[account.userId]);

	useEffect(()=>{void loadMarket()},[loadMarket]);
	useEffect(()=>{void loadP2PWallet()},[loadP2PWallet]);
	useEffect(()=>{setAmount("");setSelected(null);setOrder(null)},[asset]);

	const filtered=useMemo(()=>listings.filter(listing=>listing.asset===asset&&(payment==="All"||listing.paymentMethod===payment)&&(!amount||Number(formatP2PAmount(listing.remainingRaw))>=Number(amount))),[listings,asset,payment,amount]);
	const totalAvailable=useMemo(()=>filtered.reduce((sum,item)=>sum+Number(formatP2PAmount(item.remainingRaw)),0),[filtered]);
	const gross=Number(quantity||0)*Number(selected?.price||0);
	const max=selected?Number(formatP2PAmount(selected.remainingRaw)):0;
	const canBuy=!!selected&&!!account.userId&&account.userId!==selected.sellerId&&Number(quantity)>0&&Number(quantity)<=max;

	function openBuy(listing:P2PListing){setSelected(listing);setQuantity(formatP2PAmount(listing.remainingRaw));setOrder(null);setError("")}
	async function openPost(){
		if(!account.userId){setError("Connect and authenticate a wallet before posting an ad");return}
		await Promise.allSettled([wallet.refreshBalances(),loadP2PWallet()]);
		setPostOpen(true);
	}
	async function buy(){
		if(!selected)return;
		try{
			setBuying(true);setError("");
			setOrder((await buyP2PListing(selected.id,parseP2PAmount(quantity,selected.asset))).order);
			await Promise.all([loadMarket(),loadP2PWallet()]);
		}catch(e){setError(errorMessage(e))}finally{setBuying(false)}
	}

	return <AppShell>
		<Marketplace mode={mode} setMode={setMode} asset={asset} setAsset={setAsset} price={price} priceDate={priceDate} listings={filtered} loading={loading} error={error} userId={account.userId} payment={payment} setPayment={setPayment} amount={amount} setAmount={setAmount} bankOption={bankOption} setBankOption={setBankOption} totalAvailable={totalAvailable} p2pBalance={p2pBalance} onBuy={openBuy} onPost={openPost}/>
		<PostAdsDialog open={postOpen} onOpenChange={setPostOpen} asset={asset} price={price} mainAvailable={mainBalance?.available??0} p2pBalance={p2pBalance} initialAmount={amount} initialPayment={bankOption as (typeof P2P_PAYMENT_METHODS)[number]} onFunded={balance=>{setP2PBalances(current=>current.map(item=>item.asset===balance.asset?balance:item));void wallet.refreshBalances()}} onCreated={()=>{void loadMarket();void loadP2PWallet()}}/>
		<BuyDialog listing={selected} quantity={quantity} setQuantity={setQuantity} gross={gross} canBuy={canBuy} buying={buying} order={order} userId={account.userId} error={error} onBuy={buy} onClose={()=>{setSelected(null);setOrder(null);setError("")}}/>
	</AppShell>;
}

type MarketplaceProps={mode:"buy"|"sell";setMode:(value:"buy"|"sell")=>void;asset:P2PAsset;setAsset:(value:P2PAsset)=>void;price:string;priceDate:string;listings:P2PListing[];loading:boolean;error:string;userId?:string;payment:string;setPayment:(value:string)=>void;amount:string;setAmount:(value:string)=>void;bankOption:string;setBankOption:(value:string)=>void;totalAvailable:number;p2pBalance:P2PWalletBalance;onBuy:(listing:P2PListing)=>void;onPost:()=>void};

function Marketplace({mode,setMode,asset,setAsset,price,priceDate,listings,loading,error,userId,payment,setPayment,amount,setAmount,bankOption,setBankOption,totalAvailable,p2pBalance,onBuy,onPost}:MarketplaceProps){
	return <div className="min-h-screen bg-gradient-to-b from-background via-background/95 to-background p-6"><div className="mx-auto max-w-7xl">
		<div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><h1 className="mb-2 text-4xl font-bold tracking-tight">{mode==="buy"?"Buy":"Sell"} Crypto</h1><p className="text-muted-foreground">{mode==="buy"?"Buy crypto securely from P2P sellers in your local currency.":"Sell from your dedicated P2P wallet and receive payment in your local currency."}</p></div><div className="flex flex-wrap items-center gap-2"><Button asChild variant="ghost" className="h-10 gap-2 text-primary"><Link to="/p2p/orders"><ClipboardList className="h-4 w-4"/>Orders</Link></Button><Button asChild variant="ghost" className="h-10 gap-2"><Link to="/p2p/advertiser"><MoreHorizontal className="h-4 w-4"/>My Ads<ChevronDown className="h-3.5 w-3.5"/></Link></Button><Button variant="ghost" onClick={onPost} className="h-10 text-primary">Post Ad</Button></div></div>
		<div className="grid grid-cols-1 gap-6 lg:grid-cols-3"><div className="space-y-6 lg:col-span-2">
			<div className="flex flex-wrap gap-3"><Button onClick={()=>setMode("buy")} className={`h-11 min-w-36 px-10 font-semibold ${mode==="buy"?"bg-buy text-buy-foreground hover:bg-buy/90":"bg-muted text-muted-foreground"}`}>Buy</Button><Button onClick={()=>setMode("sell")} className={`h-11 min-w-36 px-10 font-semibold ${mode==="sell"?"bg-red-500 text-white hover:bg-red-600":"border border-border"}`} variant={mode==="sell"?"default":"outline"}>Sell</Button></div>
			<Card className="border-border/50 bg-card/30 p-6 backdrop-blur-sm"><div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3"><div className="space-y-2"><label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Asset</label><Select value={asset} onValueChange={value=>setAsset(value as P2PAsset)}><SelectTrigger className="bg-background/50"><SelectValue/></SelectTrigger><SelectContent>{P2P_ASSETS.map(item=><SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fiat</label><Select value="inr"><SelectTrigger className="bg-background/50"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="inr">INR (₹)</SelectItem></SelectContent></Select></div><div className="space-y-2"><label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{mode==="buy"?"Minimum available":"Crypto amount"}</label><Input placeholder={`Enter ${asset} amount`} type="number" value={amount} onChange={event=>setAmount(event.target.value)} className="bg-background/50"/></div></div><Button onClick={mode==="sell"?onPost:undefined} className="w-full bg-primary text-primary-foreground"><Search className="mr-2 h-4 w-4"/>{mode==="sell"?"Post Sell Ad":"Search"}</Button></Card>
			<div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><Badge variant="secondary"><Users className="mr-1 h-3 w-3"/>P2P sellers</Badge><Button variant="ghost" size="sm"><Filter className="mr-1 h-4 w-4"/>Filter</Button></div></div><div className="flex flex-wrap gap-2">{["All",...P2P_PAYMENT_METHODS].map(method=><button key={method} onClick={()=>setPayment(method)} className={`rounded-lg px-4 py-2 text-sm font-medium ${payment===method?"bg-primary text-primary-foreground":"bg-muted/30 text-muted-foreground"}`}>{method}</button>)}</div></div>
			<ListingsTable listings={listings} userId={userId} loading={loading} mode={mode} onBuy={onBuy} onPost={onPost}/>{error&&<div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
		</div><MarketplaceSidebar mode={mode} asset={asset} price={price} priceDate={priceDate} amount={amount} setAmount={setAmount} bankOption={bankOption} setBankOption={setBankOption} listings={listings} totalAvailable={totalAvailable} p2pBalance={p2pBalance} onBuy={onBuy} onPost={onPost}/></div>
		<HowItWorks/>
	</div></div>;
}

function ListingsTable({listings,userId,loading,mode,onBuy,onPost}:{listings:P2PListing[];userId?:string;loading:boolean;mode:"buy"|"sell";onBuy:(listing:P2PListing)=>void;onPost:()=>void}){
	return <Card className="overflow-hidden border-border/50 bg-card/20"><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-sm"><thead><tr className="border-b bg-muted/20"><th className="px-4 py-3 text-left">Advertiser</th><th className="px-4 py-3 text-center">Price / Available</th><th className="px-4 py-3 text-center">Payment</th><th className="px-4 py-3 text-center">Trade</th></tr></thead><tbody>{loading?<tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Loading database listings…</td></tr>:listings.length===0?<tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No active sell ads found.</td></tr>:listings.map(listing=>{const own=userId===listing.sellerId;const initials=listing.sellerAddress.slice(2,4).toUpperCase();return <tr key={listing.id} className="border-b last:border-0"><td className="px-4 py-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-primary text-xs font-bold text-primary-foreground">{initials}</div><div><div className="flex items-center gap-2 font-semibold">{shortAddress(listing.sellerAddress)}<Shield className="h-3 w-3 text-primary"/></div><div className="text-xs text-muted-foreground">Listed {new Date(listing.createdAt).toLocaleString()}</div></div></div></td><td className="px-4 py-4 text-center"><div className="font-semibold">{formatINR(listing.price)}</div><div className="text-xs text-muted-foreground">{formatP2PAmount(listing.remainingRaw)} {listing.asset}</div></td><td className="px-4 py-4 text-center"><Badge variant="secondary">{listing.paymentMethod}</Badge></td><td className="px-4 py-4 text-center"><Button size="sm" disabled={mode==="buy"&&own} onClick={()=>mode==="buy"?onBuy(listing):onPost()} className={mode==="buy"?"bg-buy text-buy-foreground":"bg-red-500 text-white"}>{mode==="buy"?(own?"YOUR AD":`BUY ${listing.asset}`):`SELL ${listing.asset}`}</Button></td></tr>})}</tbody></table></div></Card>;
}

type SidebarProps={mode:"buy"|"sell";asset:P2PAsset;price:string;priceDate:string;amount:string;setAmount:(value:string)=>void;bankOption:string;setBankOption:(value:string)=>void;listings:P2PListing[];totalAvailable:number;p2pBalance:P2PWalletBalance;onBuy:(listing:P2PListing)=>void;onPost:()=>void};
function MarketplaceSidebar({mode,asset,price,priceDate,amount,setAmount,bankOption,setBankOption,listings,totalAvailable,p2pBalance,onBuy,onPost}:SidebarProps){
	const gross=Number(amount||0)*Number(price||0);
	const match=listings.find(item=>item.paymentMethod===bankOption&&Number(formatP2PAmount(item.remainingRaw))>=Number(amount||0));
	return <div className="space-y-6"><Card className="border-border/50 bg-card/30 p-6"><span className="text-sm font-medium text-muted-foreground">Today’s Price</span><div className="mt-4 flex items-baseline gap-2"><span className="text-3xl font-bold">{price?formatINR(price):"Unavailable"}</span><span className="text-sm text-muted-foreground">/{asset}</span></div><p className="pt-2 text-xs text-muted-foreground">Database price for {priceDate||"today"}</p></Card>
	<Card className="border-border/50 bg-card/30 p-6"><h3 className="mb-4 flex items-center gap-2 font-semibold"><TrendingUp className="h-4 w-4 text-primary"/>{mode==="buy"?"Quick Trade":"Quick Sell"}</h3><div className="space-y-4"><div><label className="mb-2 block text-xs text-muted-foreground">Bank / Payment Option</label><Select value={bankOption} onValueChange={setBankOption}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{P2P_PAYMENT_METHODS.map(item=><SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div><div><label className="mb-2 block text-xs text-muted-foreground">I want to {mode}</label><div className="flex gap-2"><Input value={amount} onChange={event=>setAmount(event.target.value)} type="number" placeholder="0.00"/><span className="flex items-center rounded-md bg-muted/30 px-3">{asset}</span></div></div><div><label className="mb-2 block text-xs text-muted-foreground">{mode==="buy"?"I will pay":"Gross value"}</label><div className="flex gap-2"><Input readOnly value={gross?gross.toFixed(2):""} placeholder="0.00"/><span className="flex items-center rounded-md bg-muted/30 px-3">INR</span></div></div></div><div className="my-4 rounded-lg bg-muted/20 p-3"><SummaryRow label="Reference Price" value={price?formatINR(price):"—"}/><SummaryRow label="Fee" value="1%"/></div><Button disabled={mode==="buy"&&!match} onClick={()=>mode==="buy"&&match?onBuy(match):onPost()} className={`w-full ${mode==="buy"?"bg-buy text-buy-foreground":"bg-red-500 text-white"}`}>{mode==="buy"?"Proceed to Buy":"Proceed to Sell"}<ArrowRight className="ml-2 h-4 w-4"/></Button></Card>
	<TrustAndSnapshot asset={asset} activeAds={listings.length} totalAvailable={totalAvailable} p2pBalance={p2pBalance}/></div>;
}

function TrustAndSnapshot({asset,activeAds,totalAvailable,p2pBalance}:{asset:P2PAsset;activeAds:number;totalAvailable:number;p2pBalance:P2PWalletBalance}){return <><Card className="border-border/50 bg-card/30 p-6"><h3 className="mb-4 font-semibold">Trust & Safety</h3><div className="space-y-3"><Safety icon={Lock} title="Reserved Balance" text={`Listed ${asset} is held in order escrow`}/><Safety icon={Shield} title="Authenticated Sellers" text="Every ad belongs to a DEX wallet user"/><Safety icon={Clock} title="Controlled Release" text={`${asset} moves to the buyer only after seller release`}/></div></Card><Card className="border-border/50 bg-card/30 p-6"><h3 className="mb-4 font-semibold">Market Snapshot</h3><div className="grid grid-cols-2 gap-4"><Stat label={`Listed ${asset}`} value={totalAvailable.toLocaleString()}/><Stat label="Active Ads" value={String(activeAds)}/><Stat label="P2P available" value={`${formatP2PAmount(p2pBalance.availableRaw)} ${asset}`}/><Stat label="P2P reserved" value={`${formatP2PAmount(p2pBalance.reservedRaw)} ${asset}`}/></div></Card></>}
function Stat({label,value}:{label:string;value:string}){return <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-lg font-semibold">{value}</p></div>}
function Safety({icon:Icon,title,text}:{icon:typeof Lock;title:string;text:string}){return <div className="flex items-start gap-3"><Icon className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary"/><div><p className="text-sm font-semibold">{title}</p><p className="text-xs text-muted-foreground">{text}</p></div></div>}
function HowItWorks(){const steps=[{icon:Search,title:"Choose Offer",text:"Choose a live USDB or USDC sell ad."},{icon:Clock,title:"Pay Seller",text:"Pay externally, then mark the order as paid."},{icon:Lock,title:"Receive Crypto",text:"The seller releases escrow into your P2P wallet."}];return <div className="mb-12 mt-24 grid grid-cols-1 gap-6 md:grid-cols-3">{steps.map(({icon:Icon,title,text})=><Card key={title} className="flex flex-col items-center p-8 text-center"><Icon className="mb-4 h-6 w-6 text-primary"/><h3 className="mb-2 text-lg font-semibold">{title}</h3><p className="text-sm text-muted-foreground">{text}</p></Card>)}</div>}

type BuyDialogProps={listing:P2PListing|null;quantity:string;setQuantity:(value:string)=>void;gross:number;canBuy:boolean;buying:boolean;order:P2POrder|null;userId?:string;error:string;onBuy:()=>void;onClose:()=>void};
function BuyDialog({listing,quantity,setQuantity,gross,canBuy,buying,order,userId,error,onBuy,onClose}:BuyDialogProps){return <Dialog open={!!listing} onOpenChange={open=>!open&&onClose()}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{order?"Order created":`Buy ${listing?.asset??"crypto"}`}</DialogTitle></DialogHeader>{listing&&(order?<div className="space-y-4"><div className="rounded-xl border border-buy/30 bg-buy/10 p-5 text-center"><p className="text-lg font-bold text-buy">{formatP2PAmount(order.amountRaw)} {order.asset} held in escrow</p><p className="mt-1 text-xs text-muted-foreground">Order {order.id}</p></div><SummaryRow label="Pay using" value={order.paymentMethod}/><SummaryRow label="You pay" value={formatINR(order.buyerPayable)} strong/><p className="text-sm text-muted-foreground">Pay the seller using the selected method, then mark the order as paid. The seller must release the escrow before your P2P wallet is credited.</p><Button asChild className="w-full"><Link to="/p2p/orders">Open My Orders</Link></Button></div>:<div className="space-y-5"><div className="rounded-xl border bg-muted/30 p-4 text-sm"><SummaryRow label="Advertiser" value={shortAddress(listing.sellerAddress)}/><SummaryRow label="Price" value={`${formatINR(listing.price)} / ${listing.asset}`}/><SummaryRow label="Payment" value={listing.paymentMethod}/></div><div><label className="mb-2 block text-xs font-semibold uppercase text-muted-foreground">{listing.asset} quantity</label><Input type="number" min="0" step="0.000001" max={formatP2PAmount(listing.remainingRaw)} value={quantity} onChange={event=>setQuantity(event.target.value)}/><p className="mt-1 text-xs text-muted-foreground">Available {formatP2PAmount(listing.remainingRaw)} {listing.asset}</p></div><div className="rounded-xl border p-4 text-sm"><SummaryRow label="Gross" value={formatINR(gross)}/><SummaryRow label="Buyer fee (1%)" value={formatINR(gross*.01)}/><SummaryRow label="You pay" value={formatINR(gross*1.01)} strong/></div>{userId===listing.sellerId&&<p className="text-sm text-destructive">You cannot buy your own ad.</p>}{!userId&&<p className="text-sm text-destructive">Connect and authenticate a wallet to buy.</p>}{error&&<p className="text-sm text-destructive">{error}</p>}<Button className="w-full bg-buy text-buy-foreground" disabled={!canBuy||buying} onClick={onBuy}>{buying?"Creating order…":`Buy ${listing.asset} • ${formatINR(gross*1.01)}`}</Button></div>)}</DialogContent></Dialog>}

function SummaryRow({label,value,strong=false}:{label:string;value:string;strong?:boolean}){return <div className={`flex justify-between gap-4 py-1 text-sm ${strong?"font-semibold":""}`}><span className="text-muted-foreground">{label}</span><span>{value}</span></div>}
