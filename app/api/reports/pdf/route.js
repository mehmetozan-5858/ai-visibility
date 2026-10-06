import {listClients,listScans} from "../../../../lib/repository";
import {buildReportResponse} from "../../../../lib/report-pdf";
export const runtime="nodejs";
export async function GET(req){
 try{
  const clientId=new URL(req.url).searchParams.get("clientId")||"";
  const [allScans,clients]=await Promise.all([listScans(100),listClients()]);
  return await buildReportResponse({allScans,clients,clientId});
 }catch{return Response.json({error:"PDF raporu oluşturulamadı."},{status:500})}
}
