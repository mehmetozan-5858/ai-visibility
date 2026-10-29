import {requireAdmin,enforceSameOrigin} from '../../../../lib/api-security';
import {findClientByIdentity} from '../../../../lib/repository';
import {compareCustomerProviders} from '../../../../lib/customer-provider-comparison.mjs';
import {storeCustomerComparison} from '../../../../lib/customer-comparison-storage.mjs';
import {databasePool} from '../../../../lib/database-runtime';
import {getDatabaseUrl} from '../../../../lib/db';
import {ZERA_TASKS} from '../../../../lib/zera-evidence-orchestrator.mjs';

const TASKS=ZERA_TASKS.filter(task=>task.channel==='ai-answer');
const noStore={'Cache-Control':'private, no-store'};
// These labels are intentionally safe: never expose provider keys, raw responses or DB details.
const safeProviderReason=(reason)=>String(reason||'no-answer').slice(0,120);

function permitted(){
 return process.env.VERCEL_ENV==='production'&&
  process.env.ZERA_SINGLE_SCAN_ENABLED==='true'&&
  process.env.ZERA_GEMINI_FREE_TIER_CONFIRMED==='true'&&
  process.env.ZERA_GEMINI_SEARCH_GROUNDING_ENABLED!=='true'&&
  Boolean(process.env.GEMINI_API_KEY);
}
async function context(){
 const client=await findClientByIdentity('ZERA Clothing','');
 if(!client?.id||client.name!=='ZERA Clothing'||client.plan!=='Pilot')throw Error('ZERA Pilot unavailable');
 const url=getDatabaseUrl();if(!url)throw Error('Database unavailable');
 return {client,pool:databasePool(url)};
}
async function existing(pool,clientId){
 const table=await pool.query("SELECT to_regclass('public.zera_ai_task_attempts') AS name");
 if(!table.rows[0]?.name)return [];
 const result=await pool.query('SELECT task_id AS "taskId",status,comparison_id AS "comparisonId" FROM zera_ai_task_attempts WHERE client_id=$1',[clientId]);
 return result.rows;
}
export async function GET(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 try{
  const {client,pool}=await context();
  const attempts=await existing(pool,client.id);
  return Response.json({enabled:permitted(),maxProviderCalls:2,attempts,tasks:TASKS.map(t=>({id:t.id,query:t.query,status:attempts.find(a=>a.taskId===t.id)?.status||'pending'})),googleSearchTasks:'not-executed-by-this-runner'},{headers:noStore});
 }catch{return Response.json({error:'Queue status unavailable'},{status:503,headers:noStore})}
}
export async function POST(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 const origin=enforceSameOrigin(req);if(origin)return origin;
 if(!permitted())return Response.json({error:'Free-tier pilot gate closed'},{status:403,headers:noStore});
 let body;try{body=await req.json()}catch{return Response.json({error:'Invalid JSON'},{status:400})}
 if(body?.confirmTwoFreeGeminiTasks!==true||Object.keys(body).length!==1)
  return Response.json({error:'Explicit confirmation required'},{status:400});
 let client,pool;
 try{({client,pool}=await context())}catch{return Response.json({error:'ZERA or database unavailable'},{status:503})}
 try{
  await pool.query(`CREATE TABLE IF NOT EXISTS zera_ai_task_attempts(
   client_id UUID NOT NULL,task_id TEXT NOT NULL,status TEXT NOT NULL,
   comparison_id UUID,created_at TIMESTAMPTZ DEFAULT NOW(),
   PRIMARY KEY(client_id,task_id))`);
  const prior=await existing(pool,client.id);
  if(prior.length)return Response.json({error:'Previous attempt exists; automatic further calls blocked',attempts:prior},{status:409,headers:noStore});
  const results=[];
  for(const task of TASKS){
   // A durable claim is made BEFORE each call; parallel clicks cannot duplicate requests.
   const claim=await pool.query("INSERT INTO zera_ai_task_attempts(client_id,task_id,status) VALUES($1,$2,'started') ON CONFLICT DO NOTHING RETURNING task_id",[client.id,task.id]);
   if(!claim.rows.length){results.push({taskId:task.id,status:'already-attempted'});continue}
   try{
    const comparison=await compareCustomerProviders({client,query:task.query,providers:['gemini'],keys:{gemini:process.env.GEMINI_API_KEY}});
    const response=comparison.results.find(r=>r.provider==='gemini');
    if(!response||!['source-supported-answer','answer-received-unverified'].includes(response.status)){
     await pool.query("UPDATE zera_ai_task_attempts SET status='provider-failed' WHERE client_id=$1 AND task_id=$2",[client.id,task.id]);
     results.push({taskId:task.id,status:'provider-failed',stage:'provider',reason:safeProviderReason(response?.reason||response?.status)});
     // Stop at first failure; never burn remaining quota on a failing provider.
     break;
    }
    // A successful provider response must not be classified as a provider failure when storage fails.
    let saved;
    try{
     saved=await storeCustomerComparison({clientId:client.id,comparison});
    }catch{
     await pool.query("UPDATE zera_ai_task_attempts SET status='storage-failed' WHERE client_id=$1 AND task_id=$2",[client.id,task.id]).catch(()=>{});
     results.push({taskId:task.id,status:'storage-failed',stage:'storage',reason:'Database write failed; do not repeat the provider call'});
     break;
    }
    try{
     await pool.query("UPDATE zera_ai_task_attempts SET status='stored',comparison_id=$3 WHERE client_id=$1 AND task_id=$2",[client.id,task.id,saved.id]);
     results.push({taskId:task.id,status:'stored',verified:response.verified===true,comparisonId:saved.id});
    }catch{
     // Comparison may already be persisted. Expose its ID so an operator can reconcile safely.
     results.push({taskId:task.id,status:'reconciliation-required',stage:'attempt-status',comparisonId:saved.id,reason:'Comparison saved; attempt-status update failed'});
     break;
    }
   }catch{
    await pool.query("UPDATE zera_ai_task_attempts SET status='error' WHERE client_id=$1 AND task_id=$2",[client.id,task.id]).catch(()=>{});
    results.push({taskId:task.id,status:'error',stage:'unknown',reason:'Unexpected processing failure; check stored results'});
    break;
   }
  }
  return Response.json({results,googleSearchTasks:'not-executed',visibilityScore:null,summary:results.find(r=>r.reason)?.reason||'Completed or already attempted'},{headers:noStore});
 }catch{return Response.json({error:'Queue execution stopped; check attempt status before any retry'},{status:503,headers:noStore})}
}
