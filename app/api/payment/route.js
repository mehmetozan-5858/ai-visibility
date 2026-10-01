import {getSalesCandidates,getOrCreatePaymentIntent,reportPayment,getPaymentById} from "../../../lib/repository";
import {verifyPaymentAccessToken} from "../../../lib/admin-auth";
function money(envName,fallback){const n=Number(process.env[envName]);return Number.isFinite(n)&&n>0?Math.round(n):fallback}
function planFor(score){
  if(score<=30){
    const setupAmount=money("PRO_SETUP_PRICE",10000),monthlyAmount=money("PRO_MONTHLY_PRICE",6000);
    return {code:"pro",name:"Pro",setup:"7.500-12.500 TL",monthly:"4.500-7.500 TL/ay",setupAmount,monthlyAmount,firstPayment:setupAmount+monthlyAmount};
  }
  if(score<=55){
    const setupAmount=money("STARTER_SETUP_PRICE",7500),monthlyAmount=money("STARTER_MONTHLY_PRICE",4500);
    return {code:"starter",name:"Starter",setup:"5.000-10.000 TL",monthly:"3.500-6.000 TL/ay",setupAmount,monthlyAmount,firstPayment:setupAmount+monthlyAmount};
  }
  const setupAmount=money("MONITOR_SETUP_PRICE",5000),monthlyAmount=money("MONITOR_MONTHLY_PRICE",3000);
  return {code:"monitor",name:"Takip",setup:"5.000-7.500 TL",monthly:"2.500-4.500 TL/ay",setupAmount,monthlyAmount,firstPayment:setupAmount+monthlyAmount};
}
export async function GET(req){
  try{
    const token=new URL(req.url).searchParams.get("token")||"";
    const access=await verifyPaymentAccessToken(token);
    if(!access)return Response.json({error:"Ödeme bağlantısı geçersiz veya süresi dolmuş."},{status:401});
    const candidates=await getSalesCandidates(50),client=candidates.find(x=>x.id===access.clientId)||null;
    if(!client)return Response.json({error:"Müşteri bulunamadı."},{status:404});
    const plan=planFor(Number(client.score)||0);
    const payment=await getOrCreatePaymentIntent(client.id,plan.name,plan.setupAmount,plan.monthlyAmount);
    return Response.json({
      client,
      plan,
      payment,
      bank:{bankName:process.env.PAYMENT_BANK_NAME||"",accountHolder:process.env.PAYMENT_ACCOUNT_HOLDER||"",iban:process.env.PAYMENT_IBAN||""},
      transferReady:Boolean(process.env.PAYMENT_BANK_NAME&&process.env.PAYMENT_ACCOUNT_HOLDER&&process.env.PAYMENT_IBAN),
      cardReady:Boolean(process.env.PAYTR_MERCHANT_ID&&process.env.PAYTR_MERCHANT_KEY&&process.env.PAYTR_MERCHANT_SALT)
    });
  }catch(e){return Response.json({error:"Odeme bilgileri okunamadi.",detail:String(e?.message||e).slice(0,220)},{status:500})}
}

// env-refresh: redeploy after payment variables were configured


export async function POST(req){
  try{
    const body=await req.json();
    if(!body?.paymentId||!body?.token)return Response.json({error:"Ödeme kaydı veya güvenli bağlantı eksik."},{status:400});
    const access=await verifyPaymentAccessToken(body.token);
    if(!access)return Response.json({error:"Ödeme bağlantısı geçersiz veya süresi dolmuş."},{status:401});
    const current=await getPaymentById(body.paymentId);
    if(!current||current.clientId!==access.clientId)return Response.json({error:"Bu ödeme bağlantısı bu kayıt için geçerli değil."},{status:403});
    const payment=await reportPayment(body.paymentId);
    if(!payment)return Response.json({error:"Ödeme bildirimi alınamadı veya daha önce bildirildi."},{status:409});
    return Response.json({payment,message:"Ödeme bildiriminiz alındı. Banka kontrolünden sonra paket aktif edilecektir."});
  }catch(e){return Response.json({error:"Ödeme bildirimi alınamadı.",detail:String(e?.message||e).slice(0,220)},{status:500})}
}
