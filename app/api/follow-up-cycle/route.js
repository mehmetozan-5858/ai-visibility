import {runAutomaticOutreach} from '../../../lib/automatic-outreach';
export const runtime='nodejs';export const maxDuration=120;
function authorized(req){const a=req.headers.get('authorization')||'';return [process.env.CRON_SECRET,process.env.AUTO_HUNT_SECRET].filter(Boolean).some(x=>a==='Bearer '+x)}
export async function GET(req){
 if(!authorized(req))return Response.json({ok:false,error:'unauthorized'},{status:401});
 const out=await runAutomaticOutreach({mode:'follow'});return Response.json(out,{status:out.ok?200:503,headers:{'cache-control':'no-store'}});
}
