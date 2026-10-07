import {requireAdmin,enforceSameOrigin} from '../../../lib/api-security';
import {runPreparation} from '../../../lib/preparation-worker';
import {preparationStatus,PREPARATION_STAGES} from '../../../lib/preparation-queue';
import {withRequestBudget} from '../../../lib/request-budget';
export const runtime='nodejs';export const maxDuration=90;
const headers={'cache-control':'no-store'};
function cron(req){const a=req.headers.get('authorization')||'';return [process.env.CRON_SECRET,process.env.AUTO_HUNT_SECRET].filter(Boolean).some(x=>a==='Bearer '+x)}
async function work(stage){if(!PREPARATION_STAGES.includes(stage))return Response.json({error:'invalid-stage'},{status:400,headers});try{const out=await withRequestBudget(70000,()=>runPreparation(stage));return Response.json(out,{status:out.ok?200:503,headers})}catch{return Response.json({error:'Hazırlık kuyruğu çalıştırılamadı.'},{status:503,headers})}}
export async function GET(req){
 if(cron(req))return work(new URL(req.url).searchParams.get('stage'));
 const denied=await requireAdmin(req);if(denied)return denied;
 try{return Response.json(await preparationStatus(),{headers})}catch{return Response.json({error:'Hazırlık kuyruğu durumu alınamadı.'},{status:503,headers})}
}
export async function POST(req){
 const denied=await requireAdmin(req);if(denied)return denied;const origin=enforceSameOrigin(req);if(origin)return origin;
 // Manual operation is deliberately limited to the no-AI, no-send preflight stage.
 const body=await req.json().catch(()=>({}));if(body.stage!=='preflight')return Response.json({error:'Yalnız resmî site kontrolü bu ekrandan başlatılabilir.'},{status:400,headers});return work('preflight');
}
