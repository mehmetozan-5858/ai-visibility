import {getDashboard} from "../../../lib/repository";
import {providerStatus} from "../../../lib/providers";
import {requireAdmin} from "../../../lib/api-security";

export async function GET(req){
  const denied=await requireAdmin(req);if(denied)return denied;
  try{
    const summary=await getDashboard();
    return Response.json({summary,providers:providerStatus(),mode:summary.database.mode},{headers:{"cache-control":"no-store"}});
  }catch{
    return Response.json({error:"Panel verileri şu anda okunamıyor. Tekrar deneyin."},{status:503,headers:{"cache-control":"no-store"}});
  }
}
