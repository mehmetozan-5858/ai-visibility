import {requireAdmin,enforceSameOrigin} from '../../../lib/api-security';
import {runAutomaticOutreach,automaticOutreachStatus} from '../../../lib/automatic-outreach';
export const runtime='nodejs';export const maxDuration=120;
function cron(req){const a=req.headers.get('authorization')||'';return [process.env.CRON_SECRET,process.env.AUTO_HUNT_SECRET].filter(Boolean).some(x=>a==='Bearer '+x)}
export async function GET(req){
 if(cron(req)){try{return Response.json(await automaticOutreachStatus(),{headers:{'cache-control':'no-store'}})}catch{return Response.json({error:'Otomatik iletişim durumu alınamadı.'},{status:503})}}
 const denied=await requireAdmin(req);if(denied)return denied;
 try{return Response.json(await automaticOutreachStatus(),{headers:{'cache-control':'no-store'}})}catch{return Response.json({error:'Otomatik iletişim durumu alınamadı.'},{status:503})}
}
export async function POST(req){
 const denied=await requireAdmin(req);if(denied)return denied;const origin=enforceSameOrigin(req);if(origin)return origin;
 try{const body=await req.json().catch(()=>({}));const live=body.confirmSend===true&&body.dryRun===false;const out=await runAutomaticOutreach({dryRun:!live});return Response.json(out,{status:out.ok?200:503,headers:{'cache-control':'no-store'}})}catch{return Response.json({error:'İletişim turu tamamlanamadı.'},{status:503})}
}
