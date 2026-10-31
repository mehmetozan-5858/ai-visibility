import {readCustomerComparisonReport} from '../../../lib/customer-comparison-report.mjs';
import {databasePool} from '../../../lib/database-runtime';
import {getDatabaseUrl} from '../../../lib/db';
import {customerAccess} from "../../../lib/pilot-access";
import {cookies} from "next/headers";
import {verifyClientToken} from "../../../lib/admin-auth";
import {getClientAccount} from "../../../lib/repository";
import {resolveRequestLanguage} from "../../../lib/localized-ai";
import {getClientProfile} from "../../../lib/client-profile";
import {servicePrice,formatMoney,SERVICE_CODES} from "../../../lib/regional-pricing";

const privateJson=(body,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"private, no-store, max-age=0","Pragma":"no-cache","Vary":"Cookie, Accept-Language"}});

export async function GET(req){
  const language=resolveRequestLanguage(req,{}),en=language==="en";
  try{
    const store=await cookies();
    const session=await verifyClientToken(store.get("ai_client")?.value||"");
    if(!session)return privateJson({error:en?"Your customer session is invalid.":"Müşteri oturumu geçersiz."},401);
    const account=await getClientAccount(session.clientId);
    if(!account)return privateJson({error:en?"Customer account not found.":"Müşteri hesabı bulunamadı."},404);
    const access=await customerAccess(account);
    if(!access.allowed)return privateJson({error:en?"Customer access is not active. Contact support if you have a paid account or an active pilot.":"Müşteri erişimi aktif değil. Ödemeniz onaylıysa veya pilot erişiminiz varsa destek ekibiyle iletişime geçin."},403);
    let reportEvidence={available:false,comparisonCount:0};
    try{
      const rows=await readCustomerComparisonReport(databasePool(getDatabaseUrl()),session.clientId);
      reportEvidence={available:true,comparisonCount:rows.length};
    }catch{} // Keep the existing portal usable; do not claim evidence is ready on a read failure.
    const profile=await getClientProfile(session.clientId).catch(()=>null);
    const code=SERVICE_CODES.includes(profile?.requestedService)?profile.requestedService:"";
    const service=code?servicePrice({service:code,country:profile?.country||"",language}):null;
    const locale=language==="en"?"en-US":"tr-TR";
    return privateJson({account:{...account,access,profile,reportEvidence,service:service?{...service,formatted:formatMoney(service.amount,service.currency,locale)}:null},language});
  }catch{return privateJson({error:en?"The customer portal could not be loaded.":"Müşteri paneli yüklenemedi."},500)}
}
