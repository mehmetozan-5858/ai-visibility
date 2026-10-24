import {requireAdmin,enforceSameOrigin} from '../../../../lib/api-security';
import {registerZeraPilot} from '../../../../pilot/zera-register.mjs';
import {getClient} from '../../../../lib/repository';
import {zeraRegistrationGate} from '../../../../pilot/zera-registration-gate.mjs';
export async function POST(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 const badOrigin=enforceSameOrigin(req);if(badOrigin)return badOrigin;
 // Never permit pilot writes in production, even if preview flags leak there.
 const gate=zeraRegistrationGate(process.env);
 if(!gate.allowed)
   return Response.json({error:'Pilot registration disabled',reason:gate.reason},{status:409,headers:{'Cache-Control':'private, no-store'}});
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
