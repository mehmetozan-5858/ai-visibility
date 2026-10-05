import {cookies} from "next/headers";
import {verifyClientToken} from "../../../lib/admin-auth";
import {getClientAccount} from "../../../lib/repository";
import {resolveRequestLanguage} from "../../../lib/localized-ai";
import {getClientProfile} from "../../../lib/client-profile";
import {servicePrice,formatMoney,SERVICE_CODES} from "../../../lib/regional-pricing";

export async function GET(req){
  const language=resolveRequestLanguage(req,{}),en=language==="en";
  try{
    const store=await cookies();
    const session=await verifyClientToken(store.get("ai_client")?.value||"");
    if(!session)return Response.json({error:en?"Your customer session is invalid.":"Müşteri oturumu geçersiz."},{status:401});
    const account=await getClientAccount(session.clientId);
    if(!account)return Response.json({error:en?"Customer account not found.":"Müşteri hesabı bulunamadı."},{status:404});
    const profile=await getClientProfile(session.clientId).catch(()=>null);
    const code=SERVICE_CODES.includes(profile?.requestedService)?profile.requestedService:"";
    const service=code?servicePrice({service:code,country:profile?.country||"",language}):null;
    const locale=language==="en"?"en-US":"tr-TR";
    return Response.json({account:{...account,profile,service:service?{...service,formatted:formatMoney(service.amount,service.currency,locale)}:null},language});
  }catch{return Response.json({error:en?"The customer portal could not be loaded.":"Müşteri paneli yüklenemedi."},{status:500})}
}
