import {requireAdmin,enforceSameOrigin,checkRateLimit} from "../../../lib/api-security";
import {listCreatorWorkspace,addCreatorProfile,upsertCreatorAccount,addCreatorFinding,generateCreatorSolutionTasks,updateCreatorTask} from "../../../lib/creator-repository";

export async function GET(req){
  const denied=await requireAdmin(req);if(denied)return denied;
  try{return Response.json(await listCreatorWorkspace())}
  catch(e){return Response.json({error:"Creator çalışma alanı yüklenemedi.",detail:String(e?.message||e).slice(0,200)},{status:500})}
}

export async function POST(req){
  const denied=await requireAdmin(req);if(denied)return denied;
  const origin=enforceSameOrigin(req);if(origin)return origin;
  const limited=checkRateLimit(req,{bucket:"creator-workspace",limit:60,windowMs:10*60*1000});if(limited)return limited;
  try{
    const body=await req.json();
    if(body?.action==="add-profile")return Response.json({profile:await addCreatorProfile(body)},{status:201});
    if(body?.action==="upsert-account")return Response.json({account:await upsertCreatorAccount(body)},{status:201});
    if(body?.action==="add-finding")return Response.json({finding:await addCreatorFinding(body)},{status:201});
    if(body?.action==="generate-solutions")return Response.json({tasks:await generateCreatorSolutionTasks(body.profileId)});
    if(body?.action==="update-task")return Response.json({task:await updateCreatorTask(body.id,body.status)});
    return Response.json({error:"Geçersiz işlem."},{status:400});
  }catch(e){return Response.json({error:"Creator işlemi tamamlanamadı.",detail:String(e?.message||e).slice(0,220)},{status:500})}
}
