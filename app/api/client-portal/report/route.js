import {readCustomerComparisonReport} from '../../../../lib/customer-comparison-report.mjs';
import {databasePool} from '../../../../lib/database-runtime';
import {getDatabaseUrl,getPortalReadDatabaseUrl,portalReadDatabaseEnabled} from '../../../../lib/db';
import {withVerifiedClientTenantRead} from '../../../../lib/verified-tenant-transaction-review.mjs';
import {inspectPortalReaderPrivileges} from '../../../../lib/portal-role-readiness.mjs';
import {inspectComparisonRlsPolicy} from '../../../../lib/portal-report-rls-readiness.mjs';
import {strictReportEntitlementReady} from '../../../../lib/portal-report-entitlement.mjs';
import {strictCustomerSettlementEnabled} from '../../../../lib/customer-settlement-proof.mjs';
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
  // Legacy account scans come from the general repository pool, not from
  // the reviewed tenant reader/RLS path. In strict mode do not attach them to
  // a PDF until independently scoped scan authorization is accepted.
  const strictMode=process.env.PORTAL_TENANT_RLS_ENABLED==='true';
  const scans=strictMode?[]:account.scans.filter(s=>s.status==="completed"&&s.score!=null&&Number.isFinite(Number(s.score)));
  let comparisons=[],comparisonEvidenceUnavailable=false;
  if(process.env.PORTAL_TENANT_RLS_ENABLED==='true'){
   // PDF uses the same signed-tenant, narrow-reader and RLS gates as the
   // customer portal. Never downgrade strict PDF access to the broad writer.
   if(!strictReportEntitlementReady(access,strictCustomerSettlementEnabled()))
    return privateJson({error:"Doğrulanmış müşteri yetkisi gerekli."},503);
   if(!portalReadDatabaseEnabled())
    return privateJson({error:"Özel rapor okuma bağlantısı gerekli."},503);
   try{
    const reader=databasePool(getPortalReadDatabaseUrl());
    const privileges=await inspectPortalReaderPrivileges(reader);
    if(!privileges.ready)return privateJson({error:"Rapor okuyucu yetkisi doğrulanamadı."},503);
    const rls=await inspectComparisonRlsPolicy(reader);
    if(!rls.ready)return privateJson({error:"Rapor RLS güvenliği doğrulanamadı."},503);
    comparisons=await withVerifiedClientTenantRead(reader,store.get("ai_client")?.value||"",
     (tx,tenantId)=>readCustomerComparisonReport(tx,tenantId));
   }catch{return privateJson({error:"Güvenli müşteri raporu yüklenemedi."},503)}
  }else{
   try{comparisons=await readCustomerComparisonReport(databasePool(getDatabaseUrl()),session.clientId)}
   catch{if(!scans.length)throw Error();comparisonEvidenceUnavailable=true}
  }
  // Defensive boundary: no PDF can be generated if its comparison result
  // contains another customer, even if a DB function returns unexpected rows.
  if(!Array.isArray(comparisons)||comparisons.some(row=>row?.clientId!==session.clientId))
   return privateJson({error:"Müşteri raporu kapsamı doğrulanamadı."},503);
  if(!scans.length&&!comparisons.length)return privateJson({error:"Tamamlanmış rapor henüz yok."},409);
  const response=await buildReportResponse({comparisons,comparisonEvidenceUnavailable,pilot:access.kind==="pilot",clients:[account.client],clientId:session.clientId,allScans:scans.map(s=>({...s,clientId:session.clientId}))});
  for(const [key,value] of Object.entries(privateHeaders))response.headers.set(key,value);
  const disposition=response.headers.get("content-disposition");
  if(disposition&&(!req||new URL(req.url).searchParams.get("download")!=="1"))response.headers.set("content-disposition",disposition.replace("attachment;","inline;"));
  return response;
 }catch{return privateJson({error:"Rapor hazırlanamadı."},500)}
}
