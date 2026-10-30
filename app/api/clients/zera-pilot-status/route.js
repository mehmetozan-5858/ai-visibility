import {requireAdmin} from '../../../../lib/api-security';
import {findClientByIdentity} from '../../../../lib/repository';
import {databasePool} from '../../../../lib/database-runtime';
import {getDatabaseUrl} from '../../../../lib/db';
import {ZERA_TASKS} from '../../../../lib/zera-evidence-orchestrator.mjs';
import {buildZeraPilotDraft} from '../../../../lib/zera-pilot-draft.mjs';
import {zeraAttemptsSelectQuery} from '../../../../lib/zera-attempts-query.mjs';

const headers={'Cache-Control':'private, no-store'};
export async function GET(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 try{
  const client=await findClientByIdentity('ZERA Clothing','');
  const url=getDatabaseUrl();
  if(!client?.id||client.name!=='ZERA Clothing'||client.plan!=='Pilot'||!url)
   return Response.json({error:'pilot-status-unavailable'},{status:503,headers});
  const pool=databasePool(url);
  const tables=await pool.query(`SELECT
    to_regclass('public.zera_ai_task_attempts') IS NOT NULL AS ai,
    to_regclass('public.zera_google_evidence_reviews') IS NOT NULL AS google,
    to_regclass('public.zera_owned_site_observations') IS NOT NULL AS owned`);
  const available=tables.rows[0];
  let attempts=[];
  if(available.ai){
   const col=await pool.query("SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='zera_ai_task_attempts' AND column_name='failure_reason') AS present");
   const result=await pool.query(zeraAttemptsSelectQuery(col.rows[0]?.present===true),[client.id]);
   attempts=result.rows;
  }
  const google=available.google?await pool.query("SELECT task_id AS \"taskId\",COUNT(*)::int AS candidates FROM zera_google_evidence_reviews WHERE client_id=$1 AND status='pending-review' GROUP BY task_id",[client.id]):{rows:[]};
  const owned=available.owned?await pool.query("SELECT COUNT(*)::int AS count FROM zera_owned_site_observations WHERE client_id=$1",[client.id]):{rows:[{count:0}]};
  const tasks=ZERA_TASKS.map(t=>{
   const attempt=attempts.find(a=>a.taskId===t.id);
   const candidate=google.rows.find(a=>a.taskId===t.id);
   return {id:t.id,channel:t.channel,status:attempt?.status||'pending',pendingReviewCandidates:candidate?.candidates||0};
  });
  return Response.json({draftReport:buildZeraPilotDraft({attempts,googleCandidates:google.rows,ownedSiteCount:owned.rows[0]?.count||0}),tasks,aiAttemptCount:attempts.length,ownedSiteObservations:owned.rows[0]?.count||0,googleEvidenceVerifiedByThisEndpoint:0,visibilityScore:null,providerCallsTriggeredByStatusRequest:0,note:'Read-only diagnostic; candidate counts and attempted calls do not establish verified visibility.'},{headers});
 }catch{return Response.json({error:'pilot-status-unavailable'},{status:503,headers})}
}
