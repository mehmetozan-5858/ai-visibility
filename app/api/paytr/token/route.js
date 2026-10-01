import crypto from "node:crypto";
import {getPaymentById} from "../../../../lib/repository";
import {verifyPaymentAccessToken} from "../../../../lib/admin-auth";
export const runtime="nodejs";

function configured(){return Boolean(process.env.PAYTR_MERCHANT_ID&&process.env.PAYTR_MERCHANT_KEY&&process.env.PAYTR_MERCHANT_SALT)}
function clean(v,max=200){return String(v||"").trim().slice(0,max)}

export async function POST(req){
  try{
    if(!configured())return Response.json({error:"PayTR henüz yapılandırılmadı."},{status:503});
    const body=await req.json();
    const access=await verifyPaymentAccessToken(body?.token||"");
    if(!access)return Response.json({error:"Ödeme bağlantısı geçersiz veya süresi dolmuş."},{status:401});
    const payment=await getPaymentById(body?.paymentId);
    if(!payment)return Response.json({error:"Ödeme kaydı bulunamadı."},{status:404});
    if(payment.clientId!==access.clientId)return Response.json({error:"Bu bağlantı bu ödeme için geçerli değil."},{status:403});
    if(payment.status==="paid")return Response.json({error:"Bu ödeme zaten tamamlandı."},{status:409});

    const user_name=clean(body?.name,60),email=clean(body?.email,100),user_phone=clean(body?.phone,20),user_address=clean(body?.address,400);
    if(!user_name||!email||!email.includes("@")||!user_phone||!user_address)return Response.json({error:"Ad soyad, e-posta, telefon ve adres zorunlu."},{status:400});

    const merchant_id=process.env.PAYTR_MERCHANT_ID;
    const merchant_key=process.env.PAYTR_MERCHANT_KEY;
    const merchant_salt=process.env.PAYTR_MERCHANT_SALT;
    const user_ip=(req.headers.get("x-forwarded-for")||req.headers.get("x-real-ip")||"127.0.0.1").split(",")[0].trim().slice(0,39);
    const merchant_oid=String(payment.referenceCode||"").replace(/[^A-Za-z0-9]/g,"");
    const amountTl=(Number(payment.setupAmount)||0)+(Number(payment.monthlyAmount)||0);
    if(amountTl<=0)return Response.json({error:"Kart ödemesi için paket tutarı belirlenmedi."},{status:409});
    const payment_amount=String(Math.round(amountTl*100));
    const currency="TL",test_mode=process.env.PAYTR_TEST_MODE==="1"?"1":"0",no_installment="0",max_installment="0";
    const basket=JSON.stringify([[payment.plan+" AI Visibility Paketi",amountTl.toFixed(2),1]]);
    const user_basket=Buffer.from(basket,"utf8").toString("base64");
    const hashStr=merchant_id+user_ip+merchant_oid+email+payment_amount+user_basket+no_installment+max_installment+currency+test_mode;
    const paytr_token=crypto.createHmac("sha256",merchant_key).update(hashStr+merchant_salt).digest("base64");
    const origin=new URL(req.url).origin;

    const form=new URLSearchParams({
      merchant_id,user_ip,merchant_oid,email,payment_amount,paytr_token,user_basket,
      debug_on:process.env.PAYTR_DEBUG==="0"?"0":"1",
      no_installment,max_installment,user_name,user_address,user_phone,
      merchant_ok_url:origin+"/odeme/basarili",
      merchant_fail_url:origin+"/odeme/basarisiz",
      timeout_limit:"30",currency,test_mode,lang:"tr"
    });
    const r=await fetch("https://www.paytr.com/odeme/api/get-token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:form,cache:"no-store"});
    const text=await r.text();
    let data;try{data=JSON.parse(text)}catch{data=null}
    if(!r.ok||data?.status!=="success"||!data?.token){
      return Response.json({error:"PayTR ödeme formu açılamadı.",detail:String(data?.reason||text).slice(0,240)},{status:502});
    }
    return Response.json({token:data.token,iframeUrl:"https://www.paytr.com/odeme/guvenli/"+data.token,amount:amountTl,merchantOid:merchant_oid});
  }catch(e){
    return Response.json({error:"Kart ödeme başlatılamadı.",detail:String(e?.message||e).slice(0,240)},{status:500});
  }
}
