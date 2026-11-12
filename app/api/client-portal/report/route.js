import {readCustomerComparisonReport} from '../../../../lib/customer-comparison-report.mjs';
import {databasePool} from '../../../../lib/database-runtime';
import {getDatabaseUrl} from '../../../../lib/db';
import {customerAccess} from "../../../../lib/pilot-access";
import {cookies} from "next/headers";
import {verifyClientToken} from "../../../../lib/admin-auth";
import {getClientAccount} from "../../../../lib/repository";
import {buildReportResponse} from "../../../../lib/report-pdf";
export const runtime="nodejs";
const privateHeaders={"Cache-Control":"private, no-store, max-age=0","Pragma":"no-cache","Vary":"Cookie"};
const privateJson=(body,status)=>Response.json(body,{status,headers:privateHeaders});
export async function GET(req){
 try{
  const store=await cookies();
  const session=await verifyClientToken(store.get("ai_client")?.value||"");
  if(!session)return privateJson({error:"Müşteri oturumu gerekli."},401);
  const account=await getClientAccount(session.clientId);
  if(!account)return privateJson({error:"Müşteri bulunamadı."},404);
  const access=await customerAccess(account);
  if(!access.allowed)return privateJson({error:"Aktif ücretli hesap veya onaylı pilot erişimi gerekli."},403);
  const scans=account.scans.filter(s=>s.status==="completed"&&s.score!=null&&Number.isFinite(Number(s.score)));
  let comparisons=[],comparisonEvidenceUnavailable=false;
  try{comparisons=await readCustomerComparisonReport(databasePool(getDatabaseUrl()),session.clientId)}
  catch{if(!scans.length)throw Error();comparisonEvidenceUnavailable=true}
  if(!scans.length&&!comparisons.length)return privateJson({error:"Tamamlanmış rapor henüz yok."},409);
  const response=await buildReportResponse({comparisons,comparisonEvidenceUnavailable,pilot:access.kind==="pilot",clients:[account.client],clientId:session.clientId,allScans:scans.map(s=>({...s,clientId:session.clientId}))});
  for(const [key,value] of Object.entries(privateHeaders))response.headers.set(key,value);
  const disposition=response.headers.get("content-disposition");
  if(disposition&&(!req||new URL(req.url).searchParams.get("download")!=="1"))response.headers.set("content-disposition",disposition.replace("attachment;","inline;"));
  return response;
 }catch{return privateJson({error:"Rapor hazırlanamadı."},500)}
}
