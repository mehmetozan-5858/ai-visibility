import crypto from "node:crypto";
import {confirmCardPaymentByMerchantOid,getPaymentByMerchantOid,markCardPaymentFailedByMerchantOid} from "../../../../lib/repository";
export const runtime="nodejs";

export async function POST(req){
  try{
    const key=process.env.PAYTR_MERCHANT_KEY,salt=process.env.PAYTR_MERCHANT_SALT;
    if(!key||!salt)return new Response("PAYTR notification failed: config",{status:500,headers:{"content-type":"text/plain"}});
    const f=await req.formData();
    const merchant_oid=String(f.get("merchant_oid")||"");
    const status=String(f.get("status")||"");
    const total_amount=String(f.get("total_amount")||"");
    const hash=String(f.get("hash")||"");

    const expectedHash=crypto.createHmac("sha256",key).update(merchant_oid+salt+status+total_amount).digest("base64");
    const a=Buffer.from(hash),b=Buffer.from(expectedHash);
    if(a.length!==b.length||!crypto.timingSafeEqual(a,b)){
      return new Response("PAYTR notification failed: bad hash",{status:400,headers:{"content-type":"text/plain"}});
    }

    const payment=await getPaymentByMerchantOid(merchant_oid);
    if(!payment){
      return new Response("PAYTR notification failed: order not found",{status:404,headers:{"content-type":"text/plain"}});
    }

    if(status==="success"){
      const receivedCents=Number(total_amount);
      const expectedCents=Math.round(((Number(payment.setupAmount)||0)+(Number(payment.monthlyAmount)||0))*100);
      if(!Number.isFinite(receivedCents)||receivedCents<expectedCents){
        return new Response("PAYTR notification failed: amount mismatch",{status:400,headers:{"content-type":"text/plain"}});
      }
      if(!payment.serviceStartConsentAt){
        return new Response("PAYTR notification failed: consent missing",{status:400,headers:{"content-type":"text/plain"}});
      }
      await confirmCardPaymentByMerchantOid(merchant_oid);
    }else{
      await markCardPaymentFailedByMerchantOid(merchant_oid);
    }

    return new Response("OK",{status:200,headers:{"content-type":"text/plain"}});
  }catch{
    return new Response("PAYTR notification failed",{status:500,headers:{"content-type":"text/plain"}});
  }
}
