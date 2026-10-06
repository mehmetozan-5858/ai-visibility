import {cookies} from "next/headers";
import {verifyClientToken} from "../../../../lib/admin-auth";
import {getClientAccount} from "../../../../lib/repository";
import {buildReportResponse} from "../../../../lib/report-pdf";
export const runtime="nodejs";
export async function GET(){
 try{
  const store=await cookies();
  const session=await verifyClientToken(store.get("ai_client")?.value||"");
  if(!session)return Response.json({error:"Müşteri oturumu gerekli."},{status:401});
  const account=await getClientAccount(session.clientId);
  if(!account)return Response.json({error:"Müşteri bulunamadı."},{status:404});
  if(account.client.status==="payment-review"||!account.payments.some(p=>p.status==="paid"))return Response.json({error:"Doğrulanmış ödeme gerekli."},{status:403});
  const scans=account.scans.filter(s=>s.status==="completed"&&s.score!=null&&Number.isFinite(Number(s.score)));
  if(!scans.length)return Response.json({error:"Tamamlanmış rapor henüz yok."},{status:409});
  return await buildReportResponse({clients:[account.client],clientId:session.clientId,allScans:scans.map(s=>({...s,clientId:session.clientId}))});
 }catch{return Response.json({error:"Rapor hazırlanamadı."},{status:500})}
}
