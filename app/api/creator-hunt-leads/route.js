import {requireAdmin} from "../../../lib/api-security";
import {listCreatorHuntLeads} from "../../../lib/creator-hunt";
export async function GET(req){const denied=await requireAdmin(req);if(denied)return denied;try{return Response.json({leads:await listCreatorHuntLeads(150)})}catch(e){return Response.json({error:"Creator av kayıtları okunamadı.",detail:String(e?.message||e).slice(0,160)},{status:500})}}
