import {requireAdmin,enforceSameOrigin} from '../../../../lib/api-security';
import {findClientByIdentity} from '../../../../lib/repository';
import {compareCustomerProviders} from '../../../../lib/customer-provider-comparison.mjs';
import {storeCustomerComparison} from '../../../../lib/customer-comparison-storage.mjs';
import {databasePool} from '../../../../lib/database-runtime';
import {getDatabaseUrl} from '../../../../lib/db';
import {ZERA_TASKS} from '../../../../lib/zera-evidence-orchestrator.mjs';
import {zeraAttemptsSelectQuery} from '../../../../lib/zera-attempts-query.mjs';

const TASKS=ZERA_TASKS.filter(task=>task.channel==='ai-answer');
const noStore={'Cache-Control':'private, no-store'};
// Store bounded error categories, never provider payloads or credentials.
function safeFailureReason(value){
 const reason=String(value||'');
 if(/^provider-http-(400|401|402|403|404|408|409|429|500|502|503|504)$/.test(reason))return reason;
 if(['provider-temporarily-unavailable','provider-quota-or-rate-limit','provider-model-not-found','provider-permission-denied','empty-answer','no-answer','not-configured','failed'].includes(reason))return reason;
 if(/timeout|timed out/i.test(reason))return 'provider-timeout';
 return 'provider-error-unspecified';
}
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
 // Existing installations may not have the additive failure_reason column yet.
 const column=await pool.query("SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='zera_ai_task_attempts' AND column_name='failure_reason') AS present");
 const result=await pool.query(zeraAttemptsSelectQuery(column.rows[0]?.present===true),[clientId]);
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
  await pool.query('ALTER TABLE zera_ai_task_attempts ADD COLUMN IF NOT EXISTS failure_reason TEXT');
  const prior=await existing(pool,client.id);
  if(prior.length)return Response.json({error:'Previous attempt exists; automatic further calls blocked',attempts:prior},{status:409,headers:noStore});
  const results=[];
  for(const task of TASKS){
   // A durable claim is made BEFORE each call; parallel clicks cannot duplicate requests.
   const claim=await pool.query("INSERT INTO zera_ai_task_attempts(client_id,task_id,status) VALUES($1,$2,'started') ON CONFLICT DO NOTHING RETURNING task_id",[client.id,task.id]);
   if(!claim.rows.length){
     // Another request owns this task. Never advance to a later provider call.
     results.push({taskId:task.id,status:'already-attempted'});
     break;
    }
   try{
    const comparison=await compareCustomerProviders({client,query:task.query,providers:['gemini'],keys:{gemini:process.env.GEMINI_API_KEY}});
    const response=comparison.results.find(r=>r.provider==='gemini');
    if(!response||!['source-supported-answer','answer-received-unverified'].includes(response.status)){
     const reason=safeFailureReason(response?.reason||response?.status||'no-answer');
     await pool.query("UPDATE zera_ai_task_attempts SET status='provider-failed',failure_reason=$3 WHERE client_id=$1 AND task_id=$2",[client.id,task.id,reason]);
     results.push({taskId:task.id,status:'provider-failed',reason});
     // Stop at first failure; never burn remaining quota on a failing provider.
     break;
    }
    const saved=await storeCustomerComparison({clientId:client.id,comparison});
    await pool.query("UPDATE zera_ai_task_attempts SET status='stored',comparison_id=$3 WHERE client_id=$1 AND task_id=$2",[client.id,task.id,saved.id]);
    results.push({taskId:task.id,status:'stored',verified:response.verified===true,comparisonId:saved.id});
   }catch{
    await pool.query("UPDATE zera_ai_task_attempts SET status='error',failure_reason='internal-error' WHERE client_id=$1 AND task_id=$2",[client.id,task.id]).catch(()=>{});
    results.push({taskId:task.id,status:'error'});
    break;
   }
  }
  return Response.json({results,googleSearchTasks:'not-executed',visibilityScore:null,summary:results.find(r=>r.status==='provider-failed'||r.status==='error')?.reason||'Completed or already attempted'},{headers:noStore});
 }catch{return Response.json({error:'Queue execution stopped; check attempt status before any retry'},{status:503,headers:noStore})}
}
