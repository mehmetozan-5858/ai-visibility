import {requireAdmin,enforceSameOrigin} from '../../../../lib/api-security';
import {runGroundedZeraCheck} from '../../../../pilot/zera-grounded-gemini.mjs';
import {AUDIT_TASKS} from '../../../../pilot/zera-audit-queue.mjs';
export async function POST(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 const badOrigin=enforceSameOrigin(req);if(badOrigin)return badOrigin;
 // Stateless single-task probe: never writes to client DB; keep spending opt-in.
 if(process.env.ZERA_GROUNDED_AI_ENABLED!=='true')
  return Response.json({error:'Grounded AI scanning requires explicit budget authorization'},{status:409});
 if(!process.env.GEMINI_API_KEY)return Response.json({error:'Gemini provider unavailable'},{status:503});
 try{
  const body=await req.json();
  if(!AUDIT_TASKS.some(t=>t.id===body?.taskId))
   return Response.json({error:'Invalid allowlisted task'},{status:400});
  const result=await runGroundedZeraCheck({taskId:body.taskId,key:process.env.GEMINI_API_KEY});
  return Response.json({result,stored:false,remainingTasksNotRun:AUDIT_TASKS.length-1});
 }catch(e){return Response.json({error:'Grounded scan failed',reason:String(e?.message||'unknown').slice(0,120)},{status:502})}
}
