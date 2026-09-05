const P2P_API_URL = import.meta.env.VITE_AUTH_API_URL ?? "http://localhost:8081";

export const P2P_ASSETS = ["USDB"] as const;
export const P2P_PAYMENT_METHODS = ["UPI", "Bank Transfer", "MPESN", "NEFT", "IMPS"] as const;
export type P2PAsset = (typeof P2P_ASSETS)[number];
export type P2PPaymentMethod = (typeof P2P_PAYMENT_METHODS)[number];
export type P2PPrice = { asset:P2PAsset; fiatCurrency:string; price:string; priceDate:string; createdAt:string };
export type P2PWalletBalance = { asset:P2PAsset; availableRaw:string; reservedRaw:string; totalRaw:string };
export type P2PAdSide = "BUY"|"SELL";
export type P2PProfile = { username:string };
export type P2PListing = { id:string; creatorId:string; username:string; side:P2PAdSide; asset:P2PAsset; amountRaw:string; remainingRaw:string; price:string; fiatCurrency:string; paymentMethods:P2PPaymentMethod[]; status:"ACTIVE"|"FILLED"|"CANCELLED"; createdAt:string; updatedAt:string };
export type P2POrderStatus = "pending_payment"|"payment_made"|"completed"|"cancelled"|"appeal";
export type P2POrder = { id:string; listingId:string; sellerId:string; buyerId:string; asset:P2PAsset; amountRaw:string; escrowRaw:string; price:string; fiatCurrency:string; grossAmount:string; buyerFee:string; sellerFee:string; buyerPayable:string; sellerReceivable:string; paymentMethod:P2PPaymentMethod; status:P2POrderStatus; expiresAt:string; updatedAt:string; cancellationReason?:string; completedAt?:string; createdAt:string };

async function request<T>(path:string,options?:RequestInit):Promise<T>{
	const response=await fetch(`${P2P_API_URL}${path}`,{...options,credentials:"include"});
	if(!response.ok){let message=`${response.status} ${response.statusText}`;try{const body=await response.json() as {error?:string};if(body.error)message=body.error}catch{/* non-JSON error */}throw new Error(message)}
	return response.json() as Promise<T>;
}
const json=(body:unknown):RequestInit=>({method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
const idempotencyKey=()=>globalThis.crypto?.randomUUID?.()??`p2p-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const getP2PPrice=(asset:P2PAsset)=>request<{price:P2PPrice}>(`/p2p/price?asset=${encodeURIComponent(asset)}`);
export const getP2PWallet=()=>request<{balance?:P2PWalletBalance;balances?:P2PWalletBalance[]}>("/p2p/wallet");
export const getP2PProfile=()=>request<{profile:P2PProfile}>("/p2p/profile");
export const establishP2PUsername=(username:string)=>request<{profile:P2PProfile}>("/p2p/profile",json({username}));
export const getP2PListings=()=>request<{listings:P2PListing[]}>("/p2p/listings");
export const getMyP2PListings=()=>request<{listings:P2PListing[]}>("/p2p/my-listings");
export const getP2POrders=()=>request<{orders:P2POrder[]}>("/p2p/orders");
export const fundP2PWallet=(asset:P2PAsset,amountRaw:string)=>request<{balance:P2PWalletBalance}>("/p2p/wallet/fund",json({asset,amountRaw,idempotencyKey:idempotencyKey()}));
export const createP2PListing=(side:P2PAdSide,amountRaw:string,paymentMethods:P2PPaymentMethod[],username?:string)=>request<{listing:P2PListing}>("/p2p/listings",json({asset:"USDB",side,amountRaw,paymentMethods,username}));
export const takeP2PListing=(listingId:string,amountRaw:string,paymentMethod:P2PPaymentMethod)=>request<{order:P2POrder}>("/p2p/orders/create",json({listingId,amountRaw,paymentMethod,idempotencyKey:idempotencyKey()}));
export const markP2POrderPaid=(orderId:string)=>request<{order:P2POrder}>("/p2p/orders/paid",json({orderId}));
export const releaseP2POrder=(orderId:string)=>request<{order:P2POrder}>("/p2p/orders/release",json({orderId}));
export const cancelP2POrder=(orderId:string)=>request<{order:P2POrder}>("/p2p/orders/cancel",json({orderId}));
export const cancelP2PListing=(listingId:string)=>request<{status:string}>("/p2p/listings/cancel",json({listingId}));

export function parseP2PAmount(value:string,asset:P2PAsset):string{
	if(!/^\d+(\.\d{0,6})?$/.test(value)||Number(value)<=0)throw new Error(`Enter a valid ${asset} amount with up to 6 decimals`);
	const [whole,fraction=""]=value.split(".");return (BigInt(whole)*1_000_000n+BigInt(fraction.padEnd(6,"0"))).toString();
}
export function formatP2PAmount(raw:string,maximumFractionDigits=6):string{
	const value=BigInt(raw||"0");const whole=value/1_000_000n;const fraction=(value%1_000_000n).toString().padStart(6,"0").replace(/0+$/,"").slice(0,maximumFractionDigits);return fraction?`${whole}.${fraction}`:whole.toString();
}
export function parseUSDBAmount(value:string):string{
	if(!/^\d+(\.\d{1,2})?$/.test(value)||Number(value)<=0)throw new Error("Enter a valid USDB amount with exactly 2 decimal places");
	return parseP2PAmount(Number(value).toFixed(2),"USDB");
}
export function formatUSDBAmount(raw:string):string{
	const cents=(BigInt(raw||"0")+5_000n)/10_000n;
	return `${cents/100n}.${(cents%100n).toString().padStart(2,"0")}`;
}
export const formatINR=(value:string|number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number(value));
