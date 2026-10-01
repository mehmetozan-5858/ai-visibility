import crypto from "node:crypto";
import {confirmCardPaymentByMerchantOid,markCardPaymentFailedByMerchantOid} from "../../../../lib/repository";
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
    const expected=crypto.createHmac("sha256",key).update(merchant_oid+salt+status+total_amount).digest("base64");
    const a=Buffer.from(hash),b=Buffer.from(expected);
    if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return new Response("PAYTR notification failed: bad hash",{status:400,headers:{"content-type":"text/plain"}});
    if(status==="success")await confirmCardPaymentByMerchantOid(merchant_oid);
    else await markCardPaymentFailedByMerchantOid(merchant_oid);
    return new Response("OK",{status:200,headers:{"content-type":"text/plain"}});
  }catch(e){
    return new Response("PAYTR notification failed",{status:500,headers:{"content-type":"text/plain"}});
  }
}
