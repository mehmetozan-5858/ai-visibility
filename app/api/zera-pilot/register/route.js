import {requireAdmin,enforceSameOrigin} from '../../../../lib/api-security';
import {registerZeraPilot} from '../../../../pilot/zera-register.mjs';
import {getClient} from '../../../../lib/repository';
export async function POST(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 const badOrigin=enforceSameOrigin(req);if(badOrigin)return badOrigin;
 // Preview cannot write until dedicated isolation has been independently verified.
 if(process.env.VERCEL_ENV!=='production' && process.env.ZERA_ISOLATED_PREVIEW_DB!=='verified')
   return Response.json({error:'Preview DB isolation not verified; registration disabled'},{status:409});
 try{
  const body=await req.json();
  if(body?.pilotId!=='ZERA-DE-001'||body?.confirmPublicPilot!==true)
   return Response.json({error:'Explicit ZERA public pilot confirmation required'},{status:400});
  const result=await registerZeraPilot({approved:true});
  const client=await getClient(result.clientId);
  return Response.json({pilotId:result.pilotId,clientId:result.clientId,created:result.created,
    persisted:Boolean(client),status:result.status,scanStarted:false,
    nextStep:'Review verified client record, then separately authorize provider calls'});
 }catch(e){
  return Response.json({error:'Pilot could not be persisted',reason:String(e?.message||'unknown').slice(0,160)},{status:503});
 }
}
