import {getSalesCandidates} from "../../../lib/repository";
function planFor(score){
  if(score<=30)return {code:"pro",name:"Pro",setup:"7.500-12.500 TL",monthly:"4.500-7.500 TL/ay"};
  if(score<=55)return {code:"starter",name:"Starter",setup:"5.000-10.000 TL",monthly:"3.500-6.000 TL/ay"};
  return {code:"monitor",name:"Takip",setup:"5.000-7.500 TL",monthly:"2.500-4.500 TL/ay"};
}
export async function GET(req){
  try{
    const id=new URL(req.url).searchParams.get("clientId"),candidates=await getSalesCandidates(50),client=candidates.find(x=>x.id===id)||null;
    if(!client)return Response.json({error:"Musteri bulunamadi."},{status:404});
    return Response.json({
      client,
      plan:planFor(Number(client.score)||0),
      bank:{bankName:process.env.PAYMENT_BANK_NAME||"",accountHolder:process.env.PAYMENT_ACCOUNT_HOLDER||"",iban:process.env.PAYMENT_IBAN||""},
      transferReady:Boolean(process.env.PAYMENT_BANK_NAME&&process.env.PAYMENT_ACCOUNT_HOLDER&&process.env.PAYMENT_IBAN),
      cardReady:Boolean(process.env.BILLING_SECRET_KEY)
    });
  }catch(e){return Response.json({error:"Odeme bilgileri okunamadi.",detail:String(e?.message||e).slice(0,220)},{status:500})}
}

// env-refresh: redeploy after payment variables were configured
