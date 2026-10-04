import {getDashboard} from "../../../lib/repository";
import {providerStatus} from "../../../lib/providers";
import {requireAdmin} from "../../../lib/api-security";

export async function GET(req){
  const denied=await requireAdmin(req);if(denied)return denied;
  return Response.json({summary:await getDashboard(),providers:providerStatus(),mode:"demo"});
}
