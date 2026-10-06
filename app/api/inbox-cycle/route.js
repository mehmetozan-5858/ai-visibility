import {processInbound} from '../../../lib/inbound-mail';
import {withRequestBudget} from '../../../lib/request-budget';
export const maxDuration=90;
export async function GET(req){
 const auth=req.headers.get('authorization');if(![process.env.CRON_SECRET,process.env.AUTO_HUNT_SECRET].filter(Boolean).some(x=>auth===`Bearer ${x}`))return Response.json({error:'unauthorized'},{status:401});
 return withRequestBudget(65000,async()=>{try{return Response.json(await processInbound())}catch{return Response.json({ok:false,error:'inbox-processing-failed'},{status:500})}});
}
