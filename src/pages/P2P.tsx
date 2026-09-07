import { useCallback,useEffect,useMemo,useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog,DialogContent,DialogHeader,DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/components/ui/select";
import { ArrowRight,ClipboardList,Clock,Filter,Lock,Search,Shield,TrendingUp,Users,Wallet } from "lucide-react";
import { useWallet } from "@/lib/useWallet";
import { effectiveP2PMaxOrderFiat,formatINR,formatUSDBAmount,getP2PListings,getP2PPrice,grossUSDBAmountForNet,netUSDBAmountAfterBuyerFee,parseUSDBAmount,P2P_PAYMENT_METHODS,sellerUSDBDebitWithFee,takeP2PListing,usdbAmountFromFiat,usdbFeeAmount,type P2PListing,type P2POrder,type P2PPaymentMethod } from "@/lib/p2pApi";

const message=(error:unknown)=>error instanceof Error?error.message:"Something went wrong";
const validUSDBInput=(value:string)=>/^\d*(?:\.\d{0,6})?$/.test(value);

export default function P2P(){
	const {userId}=useWallet();
	const [action,setAction]=useState<"BUY"|"SELL">("BUY");
	const [price,setPrice]=useState("");
	const [priceDate,setPriceDate]=useState("");
	const [listings,setListings]=useState<P2PListing[]>([]);
	const [loading,setLoading]=useState(true);
	const [error,setError]=useState("");
	const [payment,setPayment]=useState("All");
	const [amount,setAmountState]=useState("");
	const [selected,setSelected]=useState<P2PListing|null>(null);
	const [quantity,setQuantityState]=useState("0");
	const [selectedPayment,setSelectedPayment]=useState<P2PPaymentMethod>("UPI");
	const [acting,setActing]=useState(false);
	const [order,setOrder]=useState<P2POrder|null>(null);
	const setAmount=(value:string)=>{if(validUSDBInput(value))setAmountState(value)};
	const setQuantity=(value:string)=>{if(validUSDBInput(value))setQuantityState(value)};

	const load=useCallback(async()=>{try{setLoading(true);setError("");const [{price:today},{listings:ads}]=await Promise.all([getP2PPrice("USDB"),getP2PListings()]);setPrice(today.price);setPriceDate(today.priceDate);setListings(ads)}catch(e){setError(message(e))}finally{setLoading(false)}},[]);
	useEffect(()=>{void load()},[load]);
	const wantedSide=action==="BUY"?"SELL":"BUY";
	const visible=useMemo(()=>listings.filter(ad=>{const requested=Number(amount||0);const fiat=requested*Number(ad.price);return ad.side===wantedSide&&(payment==="All"||ad.paymentMethods.includes(payment as P2PPaymentMethod))&&(!requested||(Number(formatUSDBAmount(ad.remainingRaw))>=requested&&fiat>=Number(ad.minOrderFiat)&&fiat<=effectiveP2PMaxOrderFiat(ad)))}),[listings,wantedSide,payment,amount]);
	const total=visible.reduce((sum,ad)=>sum+Number(formatUSDBAmount(ad.remainingRaw)),0);
	function open(ad:P2PListing){const unitPrice=Number(ad.price);const remaining=Number(formatUSDBAmount(ad.remainingRaw));const minimum=Math.ceil((Number(ad.minOrderFiat)/unitPrice)*1_000_000)/1_000_000;let initial=Math.min(minimum,remaining);if(remaining>initial&&(remaining-initial)*unitPrice<Number(ad.minOrderFiat))initial=remaining;setSelected(ad);setQuantity(String(initial));setSelectedPayment(ad.paymentMethods[0]);setOrder(null);setError("")}
	async function take(){if(!selected)return;try{setActing(true);setError("");setOrder((await takeP2PListing(selected.id,parseUSDBAmount(quantity),selectedPayment)).order);await load()}catch(e){setError(message(e))}finally{setActing(false)}}
	const match=visible.find(ad=>ad.creatorId!==userId&&Number(amount)>0);

	return <AppShell><div className="min-h-screen bg-gradient-to-b from-background via-background/95 to-background p-6"><div className="mx-auto max-w-7xl">
		<div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><h1 className="mb-2 text-4xl font-bold tracking-tight">{action==="BUY"?"Buy":"Sell"} USDB</h1><p className="text-muted-foreground">Trade USDB securely with authenticated P2P users in your local currency.</p></div><div className="flex flex-wrap items-center gap-2"><Button asChild variant="ghost" className="h-10 gap-2 text-primary"><Link to="/p2p/orders"><ClipboardList className="h-4 w-4"/>Orders</Link></Button><Button asChild variant="ghost"><Link to="/p2p/advertiser">My Ads</Link></Button><Button asChild variant="ghost"><Link to="/p2p/wallet"><Wallet className="mr-2 h-4 w-4"/>P2P Wallet</Link></Button></div></div>
		<div className="grid grid-cols-1 gap-6 lg:grid-cols-3"><div className="space-y-6 lg:col-span-2"><div className="flex gap-3"><Button onClick={()=>setAction("BUY")} className={`h-11 min-w-36 px-10 font-semibold ${action==="BUY"?"bg-buy text-buy-foreground":"bg-muted text-muted-foreground"}`}>Buy USDB</Button><Button onClick={()=>setAction("SELL")} variant={action==="SELL"?"default":"outline"} className={`h-11 min-w-36 px-10 font-semibold ${action==="SELL"?"bg-red-500 text-white":"border border-border"}`}>Sell USDB</Button></div>
			<Card className="border-border/50 bg-card/30 p-6 backdrop-blur-sm"><div className="grid grid-cols-1 gap-4 md:grid-cols-2"><div><label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Minimum available</label><Input className="mt-2 bg-background/50" placeholder="0 USDB" value={amount} onChange={event=>setAmount(event.target.value)}/></div><div><label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payment method</label><Select value={payment} onValueChange={setPayment}><SelectTrigger className="mt-2 bg-background/50"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="All">All</SelectItem>{P2P_PAYMENT_METHODS.map(item=><SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div></div></Card>
			<div className="flex items-center gap-2"><Badge variant="secondary"><Users className="mr-1 h-3 w-3"/>P2P advertisers</Badge><Button variant="ghost" size="sm"><Filter className="mr-1 h-4 w-4"/>Filter</Button></div>
			<Card className="overflow-hidden border-border/50 bg-card/20"><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm"><thead><tr className="border-b bg-muted/20"><th className="px-4 py-3 text-left">Advertiser</th><th className="px-4 py-3 text-center">Available / Limits</th><th className="px-4 py-3 text-center">Payment Methods</th><th className="px-4 py-3 text-center">Option</th></tr></thead><tbody>{loading?<tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Loading database listings…</td></tr>:visible.length===0?<tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No matching USDB ads found.</td></tr>:visible.map(ad=>{const own=userId===ad.creatorId;return <tr key={ad.id} className="border-b last:border-0"><td className="px-4 py-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-primary text-xs font-bold text-primary-foreground">{ad.username.slice(0,2).toUpperCase()}</div><div><div className="flex items-center gap-2 font-semibold">{ad.username}<Shield className="h-3 w-3 text-primary"/></div><div className="text-xs text-muted-foreground">{ad.ratedOrders30d>0?`${ad.completedOrders30d} trades · ${Number(ad.completionRate30d).toFixed(2)}% completion`:"New advertiser"}</div></div></div></td><td className="px-4 py-4 text-center"><div className="font-semibold">{formatUSDBAmount(ad.remainingRaw)} USDB</div><div className="mt-1 text-xs text-muted-foreground">Limits {formatINR(ad.minOrderFiat)} – {formatINR(effectiveP2PMaxOrderFiat(ad))}</div></td><td className="px-4 py-4 text-center"><div className="flex flex-wrap justify-center gap-1">{ad.paymentMethods.map(method=><Badge key={method} variant="secondary">{method}</Badge>)}</div></td><td className="px-4 py-4 text-center">{own?<Badge variant="outline">Your ad</Badge>:<Button size="sm" onClick={()=>open(ad)} className={ad.side==="SELL"?"bg-buy text-buy-foreground":"bg-red-500 text-white"}>{ad.side==="SELL"?"BUY USDB":"SELL USDB"}</Button>}</td></tr>})}</tbody></table></div></Card>{error&&<div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
		</div><div className="space-y-6"><Card className="border-border/50 bg-card/30 p-6"><span className="text-sm font-medium text-muted-foreground">Today’s Price</span><div className="mt-4 flex items-baseline gap-2"><span className="text-3xl font-bold">{price?formatINR(price):"Unavailable"}</span><span className="text-sm text-muted-foreground">/USDB</span></div><p className="pt-2 text-xs text-muted-foreground">Database price for {priceDate||"today"}</p></Card>
			<Card className="border-border/50 bg-card/30 p-6"><h3 className="mb-4 flex items-center gap-2 font-semibold"><TrendingUp className="h-4 w-4 text-primary"/>Quick Trade</h3><Input value={amount} onChange={event=>setAmount(event.target.value)} placeholder="0 USDB"/><div className="my-4 rounded-lg bg-muted/20 p-3 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Available across ads</span><span>{Number(total.toFixed(6))} USDB</span></div></div><Button disabled={!match} onClick={()=>match&&open(match)} className={`w-full ${action==="BUY"?"bg-buy text-buy-foreground":"bg-red-500 text-white"}`}>{action==="BUY"?"Proceed to Buy":"Proceed to Sell"}<ArrowRight className="ml-2 h-4 w-4"/></Button></Card>
			{/* <Card className="border-border/50 bg-card/30 p-6"><h3 className="mb-4 font-semibold">Trust & Safety</h3><div className="space-y-3"><Safety icon={Lock} title="Escrow Protection" text="Seller USDB is held until release"/><Safety icon={Shield} title="Authenticated Users" text="Every ad has a permanent P2P username"/><Safety icon={Clock} title="Controlled Release" text="USDB moves only after payment confirmation"/></div></Card> */}
			{/* <MarketSnapshot listings={listings}/> */}
			</div></div>
		{/* <HowItWorks/> */}
	</div></div><TradeDialog ad={selected} quantity={quantity} setQuantity={setQuantity} payment={selectedPayment} setPayment={setSelectedPayment} order={order} error={error} acting={acting} userId={userId} onTake={take} onClose={()=>{setSelected(null);setOrder(null);setError("")}}/></AppShell>;
}

function TradeDialog({ad,quantity,setQuantity,payment,setPayment,order,error,acting,userId,onTake,onClose}:{ad:P2PListing|null;quantity:string;setQuantity:(v:string)=>void;payment:P2PPaymentMethod;setPayment:(v:P2PPaymentMethod)=>void;order:P2POrder|null;error:string;acting:boolean;userId?:string;onTake:()=>void;onClose:()=>void}){
	const [linkedInputs,setLinkedInputs]=useState({adId:"",fiat:"0.00",receive:"0"});
	const amount=Number(quantity||0);
	const fiatInput=linkedInputs.adId===ad?.id?linkedInputs.fiat:(amount*Number(ad?.price||0)).toFixed(2);
	const receiveInput=linkedInputs.adId===ad?.id?linkedInputs.receive:netUSDBAmountAfterBuyerFee(amount);
	const gross=amount*Number(ad?.price||0);
	const remaining=Number(formatUSDBAmount(ad?.remainingRaw||"0"));
	const remainingAfter=remaining-amount;
	const effectiveMaximum=ad?effectiveP2PMaxOrderFiat(ad):0;
	const fee=usdbFeeAmount(quantity);
	const viewerAction=ad?.side==="SELL"?"Buy":"Sell";
	const remainderBelowMinimum=!!ad&&remainingAfter>0&&remainingAfter*Number(ad.price)<Number(ad.minOrderFiat);
	const validationMessage=!ad||amount<=0?"":amount>remaining?`Only ${formatUSDBAmount(ad.remainingRaw)} USDB is available.`:gross<Number(ad.minOrderFiat)?`The minimum order is ${formatINR(ad.minOrderFiat)}.`:gross>effectiveMaximum?`The maximum order is ${formatINR(effectiveMaximum)}.`:remainderBelowMinimum?`This would leave ${Number(remainingAfter.toFixed(6))} USDB, below the ad minimum. ${viewerAction} the full ${formatUSDBAmount(ad.remainingRaw)} USDB or leave at least ${Number((Number(ad.minOrderFiat)/Number(ad.price)).toFixed(6))} USDB for another order.`:"";
	const valid=!!ad&&userId!==ad.creatorId&&amount>0&&!validationMessage;
	function updateFiatInvestment(value:string){
		if(!validUSDBInput(value))return;
		const nextQuantity=usdbAmountFromFiat(value,ad?.price||0);
		setQuantity(nextQuantity);
		setLinkedInputs({adId:ad?.id??"",fiat:value,receive:netUSDBAmountAfterBuyerFee(nextQuantity)});
	}
	function updateNetUSDB(value:string){
		if(!validUSDBInput(value))return;
		const nextQuantity=grossUSDBAmountForNet(value);
		setQuantity(nextQuantity);
		setLinkedInputs({adId:ad?.id??"",fiat:(Number(nextQuantity)*Number(ad?.price||0)).toFixed(2),receive:value});
	}
	function updateGrossUSDB(value:string){
		if(!validUSDBInput(value))return;
		setQuantity(value);
		setLinkedInputs({adId:ad?.id??"",fiat:(Number(value||0)*Number(ad?.price||0)).toFixed(2),receive:netUSDBAmountAfterBuyerFee(value)});
	}
	function normalizeFiatInvestment(){updateFiatInvestment((Number(fiatInput)||0).toFixed(2))}
	function normalizeNetUSDB(){updateNetUSDB(String(Number(receiveInput)||0))}
	function normalizeGrossUSDB(){updateGrossUSDB(String(Number(quantity)||0))}
	function close(){setLinkedInputs({adId:"",fiat:"0.00",receive:"0"});onClose()}
	return <TradeDialogView ad={ad} quantity={quantity} fiatInput={fiatInput} receiveInput={receiveInput} payment={payment} setPayment={setPayment} order={order} error={error} acting={acting} userId={userId} onTake={onTake} onClose={close} gross={gross} effectiveMaximum={effectiveMaximum} fee={fee} viewerAction={viewerAction} valid={valid} validationMessage={validationMessage} updateFiatInvestment={updateFiatInvestment} updateNetUSDB={updateNetUSDB} updateGrossUSDB={updateGrossUSDB} normalizeFiatInvestment={normalizeFiatInvestment} normalizeNetUSDB={normalizeNetUSDB} normalizeGrossUSDB={normalizeGrossUSDB}/>;
}

type TradeDialogViewProps={
	ad:P2PListing|null;
	quantity:string;
	fiatInput:string;
	receiveInput:string;
	payment:P2PPaymentMethod;
	setPayment:(value:P2PPaymentMethod)=>void;
	order:P2POrder|null;
	error:string;
	acting:boolean;
	userId?:string;
	onTake:()=>void;
	onClose:()=>void;
	gross:number;
	effectiveMaximum:number;
	fee:string;
	viewerAction:"Buy"|"Sell";
	valid:boolean;
	validationMessage:string;
	updateFiatInvestment:(value:string)=>void;
	updateNetUSDB:(value:string)=>void;
	updateGrossUSDB:(value:string)=>void;
	normalizeFiatInvestment:()=>void;
	normalizeNetUSDB:()=>void;
	normalizeGrossUSDB:()=>void;
};

function TradeDialogView({ad,quantity,fiatInput,receiveInput,payment,setPayment,order,error,acting,userId,onTake,onClose,gross,effectiveMaximum,fee,viewerAction,valid,validationMessage,updateFiatInvestment,updateNetUSDB,updateGrossUSDB,normalizeFiatInvestment,normalizeNetUSDB,normalizeGrossUSDB}:TradeDialogViewProps){
	return <Dialog open={!!ad} onOpenChange={open=>!open&&onClose()}>
		<DialogContent className="max-w-lg">
			<DialogHeader><DialogTitle>{order?"Order created":`${viewerAction} USDB ${ad?.side==="SELL"?"from":"to"} ${ad?.username??""}`}</DialogTitle></DialogHeader>
			{ad&&(order?<div className="space-y-4">
				<div className="rounded-xl border border-buy/30 bg-buy/10 p-5 text-center"><p className="text-lg font-bold text-buy">{formatUSDBAmount(order.sellerDebitRaw)} USDB held in escrow</p></div>
				<Row label="Payment method" value={order.paymentMethod}/>
				<Row label="External payment" value={formatINR(order.grossAmount)}/>
				<Row label={`${order.buyerId===userId?"Buyer":"Seller"} fee (1%)`} value={`${formatUSDBAmount(order.buyerId===userId?order.buyerFeeRaw:order.sellerFeeRaw)} USDB`}/>
				<Row label={order.buyerId===userId?"You receive":"USDB escrowed"} value={`${formatUSDBAmount(order.buyerId===userId?order.buyerCreditRaw:order.sellerDebitRaw)} USDB`}/>
				<Button asChild className="w-full"><Link to={`/p2p/orders/${order.id}`}>Open order</Link></Button>
			</div>:<div className="space-y-5">
				<div className="rounded-xl border bg-muted/30 p-4 text-sm">
					<Row label="Advertiser" value={ad.username}/>
					<Row label="Price" value={`${formatINR(ad.price)} / USDB`}/>
					<Row label="Available" value={`${formatUSDBAmount(ad.remainingRaw)} USDB`}/>
					<Row label="Order limit" value={`${formatINR(ad.minOrderFiat)} – ${formatINR(effectiveMaximum)}`}/>
				</div>
				{viewerAction==="Buy"?<div className="space-y-4">
					<div>
						<label className="mb-2 block text-xs font-semibold uppercase text-muted-foreground">You pay</label>
						<div className="flex gap-2"><Input aria-label="You pay in INR" inputMode="decimal" value={fiatInput} onChange={event=>updateFiatInvestment(event.target.value)} onBlur={normalizeFiatInvestment}/><span className="flex min-w-20 items-center justify-center rounded-md bg-muted/30 px-3">INR</span></div>
					</div>
					<div>
						<label className="mb-2 block text-xs font-semibold uppercase text-muted-foreground">You receive</label>
						<div className="flex gap-2"><Input aria-label="You receive in USDB" inputMode="decimal" value={receiveInput} onChange={event=>updateNetUSDB(event.target.value)} onBlur={normalizeNetUSDB}/><span className="flex min-w-20 items-center justify-center rounded-md bg-muted/30 px-3">USDB</span></div>
					</div>
					<p className="text-xs text-muted-foreground">USDB received is shown after the 1% buyer fee. Order value must be within {formatINR(ad.minOrderFiat)} – {formatINR(effectiveMaximum)}.</p>
				</div>:<div className="space-y-4">
					<div>
						<label className="mb-2 block text-xs font-semibold uppercase text-muted-foreground">You receive</label>
						<div className="flex gap-2"><Input aria-label="You receive in INR" inputMode="decimal" value={fiatInput} onChange={event=>updateFiatInvestment(event.target.value)} onBlur={normalizeFiatInvestment}/><span className="flex min-w-20 items-center justify-center rounded-md bg-muted/30 px-3">INR</span></div>
					</div>
					<div>
						<label className="mb-2 block text-xs font-semibold uppercase text-muted-foreground">You sell</label>
						<div className="flex gap-2"><Input aria-label="You sell in USDB" inputMode="decimal" value={quantity} onChange={event=>updateGrossUSDB(event.target.value)} onBlur={normalizeGrossUSDB}/><span className="flex min-w-20 items-center justify-center rounded-md bg-muted/30 px-3">USDB</span></div>
					</div>
					<p className="text-xs text-muted-foreground">The 1% seller fee is added to the USDB escrow. Order value must be within {formatINR(ad.minOrderFiat)} – {formatINR(effectiveMaximum)}.</p>
				</div>}
				{validationMessage&&<p className="text-sm text-destructive">{validationMessage}</p>}
				<div>
					<label className="mb-2 block text-xs font-semibold uppercase text-muted-foreground">Payment method</label>
					<Select value={payment} onValueChange={value=>setPayment(value as P2PPaymentMethod)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{ad.paymentMethods.map(method=><SelectItem key={method} value={method}>{method}</SelectItem>)}</SelectContent></Select>
				</div>
				<div className="rounded-xl border p-4 text-sm">
					<Row label={viewerAction==="Buy"?"You pay externally":"You receive externally"} value={formatINR(gross)}/>
					<Row label={`${viewerAction} fee (1%)`} value={`${fee} USDB`}/>
					<Row label={viewerAction==="Buy"?"You receive":"Total USDB escrowed"} value={`${viewerAction==="Buy"?netUSDBAmountAfterBuyerFee(quantity):sellerUSDBDebitWithFee(quantity)} USDB`}/>
				</div>
				{error&&<p className="text-sm text-destructive">{error}</p>}
				<Button className={`w-full ${viewerAction==="Buy"?"bg-buy text-buy-foreground":"bg-red-500 text-white"}`} disabled={!valid||acting} onClick={onTake}>{acting?"Creating order…":viewerAction==="Buy"?`Buy ${netUSDBAmountAfterBuyerFee(quantity)} USDB`:`Sell ${quantity || "0"} USDB`}</Button>
			</div>)}
		</DialogContent>
	</Dialog>;
}

function Row({label,value}:{label:string;value:string}){return <div className="flex justify-between gap-4 py-1"><span className="text-muted-foreground">{label}</span><span>{value}</span></div>}
function Safety({icon:Icon,title,text}:{icon:typeof Lock;title:string;text:string}){return <div className="flex items-start gap-3"><Icon className="mt-0.5 h-5 w-5 text-primary"/><div><p className="text-sm font-semibold">{title}</p><p className="text-xs text-muted-foreground">{text}</p></div></div>}
function MarketSnapshot({listings}:{listings:P2PListing[]}){const buyAds=listings.filter(ad=>ad.side==="BUY");const sellAds=listings.filter(ad=>ad.side==="SELL");const listed=listings.reduce((sum,ad)=>sum+Number(formatUSDBAmount(ad.remainingRaw)),0);return <Card className="border-border/50 bg-card/30 p-6"><h3 className="mb-4 font-semibold">Market Snapshot</h3><div className="grid grid-cols-2 gap-4"><Stat label="Listed USDB" value={`${Number(listed.toFixed(6))} USDB`}/><Stat label="Active Ads" value={String(listings.length)}/><Stat label="Buy Ads" value={String(buyAds.length)}/><Stat label="Sell Ads" value={String(sellAds.length)}/></div></Card>}
function Stat({label,value}:{label:string;value:string}){return <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-lg font-semibold">{value}</p></div>}
function HowItWorks(){const steps=[{icon:Search,title:"Choose Offer",text:"Choose a live USDB buy or sell ad."},{icon:Clock,title:"Complete Payment",text:"The buyer pays externally and marks the order as paid."},{icon:Lock,title:"Receive USDB",text:"The seller releases escrow into the buyer's P2P wallet."}];return <div className="mb-12 mt-24 grid grid-cols-1 gap-6 md:grid-cols-3">{steps.map(({icon:Icon,title,text})=><Card key={title} className="flex flex-col items-center p-8 text-center"><Icon className="mb-4 h-6 w-6 text-primary"/><h3 className="mb-2 text-lg font-semibold">{title}</h3><p className="text-sm text-muted-foreground">{text}</p></Card>)}</div>}
