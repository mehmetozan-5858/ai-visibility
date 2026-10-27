/** Admin diagnostics only: no provider requests, migrations, claims or retries. */
const modelDefault='gemini-3.8-flash'; // Matches the current comparison engine.
const tables=['clients','ai_provider_comparisons','zera_ai_task_attempts'];
const taskIds=['brand-ai-de','brand-ai-tr'];
const statuses=new Set(['started','stored','provider-failed','error']);
const reasons=new Set(['provider-temporarily-unavailable','provider-quota-or-rate-limit','provider-model-not-found',
 'provider-permission-denied','provider-timeout','provider-error-unspecified','empty-answer','no-answer','not-configured','failed']);
function safeReason(value){
 if(typeof value!=='string')return null;
 return reasons.has(value)||/^provider-http-(400|401|402|403|404|408|409|429|500|502|503|504)$/.test(value)?value:null;
}
export function diagnosticSettings(env={}){
 const configured=env.ZERA_GEMINI_MODEL,model=configured||modelDefault;
 return {runtime:env.VERCEL_ENV==='production'?'production':env.VERCEL_ENV==='preview'?'preview':'other',
  geminiKeyConfigured:Boolean(env.GEMINI_API_KEY),
  model:/^[A-Za-z0-9][A-Za-z0-9._-]{0,100}$/.test(model)?model:null,
  modelConfigurationValid:/^[A-Za-z0-9][A-Za-z0-9._-]{0,100}$/.test(model),
  modelSource:configured?'server-setting':'application-default',
  singleScanEnabled:env.ZERA_SINGLE_SCAN_ENABLED==='true',
  freeTierClaimConfigured:env.ZERA_GEMINI_FREE_TIER_CONFIRMED==='true',
  searchGroundingConfigured:env.ZERA_GEMINI_SEARCH_GROUNDING_ENABLED==='true',
  providerAccessVerified:false,providerQuotaVerified:false};
}
const failureCodes=new Map([['42P01','schema-unavailable'],['42703','schema-mismatch'],['42501','storage-permission-denied'],
 ['57014','storage-timeout'],['55P03','storage-lock-timeout']]);
const safeFailure=error=>failureCodes.get(error?.code)||'storage-inspection-unavailable';

export async function readZeraDiagnostics({pool,env={}}){
 const settings=diagnosticSettings(env),tx=await pool.connect();
 try{
  await tx.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await tx.query("SET LOCAL statement_timeout='3000ms'");
  await tx.query("SET LOCAL lock_timeout='1000ms'");
  const columns=(await tx.query(`SELECT table_name,column_name,data_type FROM information_schema.columns
   WHERE table_schema='public' AND table_name=ANY($1::text[])`,[tables])).rows;
  const fields=name=>new Map(columns.filter(c=>c.table_name===name).map(c=>[c.column_name,c.data_type]));
  const clients=fields('clients');
  if(clients.get('id')!=='uuid'||clients.get('name')!=='text'||clients.get('plan')!=='text'){
   const error=Error('schema');error.code='42703';throw error;
  }
  const matches=(await tx.query('SELECT id,plan FROM public.clients WHERE name=$1 LIMIT 2',['ZERA Clothing'])).rows;
  const pilot=matches.length===1&&matches[0].plan==='Pilot'?matches[0]:null;
  const comparisons=fields('ai_provider_comparisons');
  const schemaReady=comparisons.get('id')==='uuid'&&comparisons.get('client_id')==='uuid'&&
   comparisons.get('query')==='text'&&comparisons.get('results')==='jsonb'&&comparisons.has('created_at');
  let count=null,truncated=false,insertPrivilege=null;
  if(schemaReady){
   insertPrivilege=(await tx.query("SELECT has_table_privilege(current_user,'public.ai_provider_comparisons','INSERT') AS allowed")).rows[0]?.allowed===true;
   if(pilot){
    const n=(await tx.query('SELECT COUNT(*)::int AS n FROM (SELECT 1 FROM public.ai_provider_comparisons WHERE client_id=$1 LIMIT 5001) bounded',[pilot.id])).rows[0].n;
    count=Math.min(n,5000);truncated=n>5000;
   }
  }
  const attemptFields=fields('zera_ai_task_attempts');
  const attemptsReadable=attemptFields.get('client_id')==='uuid'&&attemptFields.get('task_id')==='text'&&attemptFields.get('status')==='text';
  const reasonAvailable=attemptFields.get('failure_reason')==='text';
  let attempts=[];
  if(pilot&&attemptsReadable){
   // Only the static optional column is selected; never interpolate input.
   const reasonColumn=reasonAvailable?',failure_reason':'';
   attempts=(await tx.query('SELECT task_id,status'+reasonColumn+' FROM public.zera_ai_task_attempts WHERE client_id=$1 AND task_id=ANY($2::text[]) LIMIT 3',[pilot.id,taskIds])).rows;
  }
  const ambiguous=taskIds.some(id=>attempts.filter(a=>a.task_id===id).length>1);
  const tasks=taskIds.map(taskId=>{
   const row=attempts.find(a=>a.task_id===taskId);
   return {taskId,status:ambiguous?'ambiguous':row?(statuses.has(row.status)?row.status:'unknown'):'not-observed',
    failureReason:ambiguous?null:safeReason(row?.failure_reason)};
  });
  await tx.query('COMMIT');
  return {settings,pilot:{identified:Boolean(pilot),identityAmbiguous:matches.length>1},
   storage:{comparisonTablePresent:comparisons.size>0,comparisonSchemaCompatible:schemaReady,
    insertPrivilege,insertActuallyTested:false,comparisonCount:count,comparisonCountTruncated:truncated,
    attemptTableReadable:attemptsReadable,failureReasonColumnAvailable:reasonAvailable},tasks,
   historicalFailureCauseKnown:false,readOnly:true,providerRequests:0,automaticRetryAllowed:false,
   capturedAt:new Date().toISOString()};
 }catch(error){await tx.query('ROLLBACK').catch(()=>{});const safe=Error(safeFailure(error));safe.diagnosticReason=safe.message;throw safe}
 finally{tx.release()}
}

export function createZeraDiagnosticsHandler({authorize,getPool,getSettings}){
 const headers={'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie'};
 return async function GET(req){
  const denied=await authorize(req);if(denied)return denied;
  if(req.method!=='GET')return Response.json({error:'read-only-endpoint'},{status:405,headers});
  if(new URL(req.url).search)return Response.json({error:'selectors-not-accepted'},{status:400,headers});
  try{
   const pool=getPool();if(!pool)return Response.json({error:'database-not-configured'},{status:503,headers});
   return Response.json(await readZeraDiagnostics({pool,env:getSettings()}),{headers});
  }catch(error){return Response.json({error:'diagnostics-unavailable',reason:'storage-inspection-unavailable',
    ...(['schema-unavailable','schema-mismatch','storage-permission-denied','storage-timeout','storage-lock-timeout','storage-inspection-unavailable'].includes(error?.diagnosticReason)?{reason:error.diagnosticReason}:{})},
   {status:503,headers});}
 };
}
