export function shopierProduct(plan,raw=process.env.SHOPIER_PRODUCTS_JSON||''){
 let products;try{products=JSON.parse(raw)}catch{return null}
 const item=products?.[`${plan.code}:${plan.currency}`];if(!item)return null;
 try{const url=new URL(item.url);
  if(url.protocol!=='https:'||!['shopier.com','www.shopier.com'].includes(url.hostname)||url.username||url.password||url.port)return null;
  if(item.currency!==plan.currency||Number(item.amount)!==plan.firstPayment||!Number.isFinite(Number(item.amount))||Number(item.amount)<=0)return null;
  return {url:url.toString(),currency:item.currency,amount:Number(item.amount)};
 }catch{return null}
}
export function paymentMatchesPlan(payment,plan){
 return payment.plan===plan.name&&payment.currency===plan.currency&&Number(payment.setupAmount)===plan.setupAmount&&Number(payment.monthlyAmount)===plan.monthlyAmount;
}
