import {customerAccess} from "../../../../lib/pilot-access";
import {cookies} from "next/headers";
import {verifyClientToken} from "../../../../lib/admin-auth";
import {getClientAccount} from "../../../../lib/repository";
import {buildReportResponse} from "../../../../lib/report-pdf";
export const runtime="nodejs";
export async function GET(req){
 try{
  const store=await cookies();
  const session=await verifyClientToken(store.get("ai_client")?.value||"");
  if(!session)return Response.json({error:"Müşteri oturumu gerekli."},{status:401});
  const account=await getClientAccount(session.clientId);
  if(!account)return Response.json({error:"Müşteri bulunamadı."},{status:404});
  const access=await customerAccess(account);
  if(!access.allowed)return Response.json({error:"Doğrulanmış ödeme gerekli."},{status:403});
  const scans=account.scans.filter(s=>s.status==="completed"&&s.score!=null&&Number.isFinite(Number(s.score)));
  if(!scans.length)return Response.json({error:"Tamamlanmış rapor henüz yok."},{status:409});
  const response=await buildReportResponse({pilot:access.kind==="pilot",clients:[account.client],clientId:session.clientId,allScans:scans.map(s=>({...s,clientId:session.clientId}))});
  if(!req||new URL(req.url).searchParams.get("download")!=="1")response.headers.set("content-disposition",response.headers.get("content-disposition").replace("attachment;","inline;"));
  return response;
 }catch{return Response.json({error:"Rapor hazırlanamadı."},{status:500})}
}
