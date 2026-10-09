import {databasePool,initializeSchema} from './database-runtime';
import {getDatabaseUrl} from './db';
import {needsProspectPreparation} from './outreach-selection.js';
export const PREPARATION_STAGES=['preflight','analysis','contact'];
export async function preparationPool(){
 const url=getDatabaseUrl();if(!url)throw Error('database-required');const pool=databasePool(url);
 await initializeSchema(pool,'prospect-preparation-v1',async tx=>{
  await tx.query(`CREATE TABLE IF NOT EXISTS prospect_preparation_jobs(id UUID PRIMARY KEY,prospect_id UUID NOT NULL,stage TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',priority INTEGER NOT NULL DEFAULT 0,attempts INTEGER NOT NULL DEFAULT 0,available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),lease_id UUID,lease_until TIMESTAMPTZ,payload JSONB NOT NULL DEFAULT '{}',last_error TEXT NOT NULL DEFAULT '',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(prospect_id,stage))`);
  await tx.query('CREATE INDEX IF NOT EXISTS preparation_ready ON prospect_preparation_jobs(stage,status,available_at,priority DESC)');
  await tx.query('CREATE TABLE IF NOT EXISTS preparation_ai_attempts(id UUID PRIMARY KEY,job_id UUID NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
 });return pool;
}
export async function enqueuePreparation(rows,pool=undefined){
 pool ||= await preparationPool();
 const selected=rows.filter(x=>needsProspectPreparation(x)&&!x.selectionBlocked&&Number(x.qualificationScore)>=45&&!x.replyStatus&&!x.clientId&&!['lost','won'].includes(x.crmStage)&&!['sent','follow-up-due'].includes(x.communicationStatus)&&!/(berlin.?klinik|audi\s*dental|do\s*&\s*co.*restaurant)/i.test(x.name||'')).slice(0,1000);
 if(!selected.length)return 0;
 const payload=JSON.stringify(selected.map(x=>({id:x.id,jobId:crypto.randomUUID(),priority:Math.max(0,Math.min(100,Number(x.selectionPriority)||0))})));
 const r=await pool.query(`INSERT INTO prospect_preparation_jobs(id,prospect_id,stage,priority)
   SELECT (j->>'jobId')::uuid,(j->>'id')::uuid,'preflight',(j->>'priority')::int
   FROM jsonb_array_elements($1::jsonb) j
   ON CONFLICT(prospect_id,stage) DO UPDATE SET
     priority=EXCLUDED.priority,
     status=CASE WHEN prospect_preparation_jobs.status='done' AND NOT EXISTS(
       SELECT 1 FROM prospect_preparation_jobs downstream
       WHERE downstream.prospect_id=EXCLUDED.prospect_id
         AND downstream.stage IN ('analysis','contact')
         AND downstream.status IN ('pending','retry','waiting','processing','needs-review')
     ) THEN 'pending' ELSE prospect_preparation_jobs.status END,
     attempts=CASE WHEN prospect_preparation_jobs.status='done' AND NOT EXISTS(
       SELECT 1 FROM prospect_preparation_jobs downstream
       WHERE downstream.prospect_id=EXCLUDED.prospect_id
         AND downstream.stage IN ('analysis','contact')
         AND downstream.status IN ('pending','retry','waiting','processing','needs-review')
     ) THEN 0 ELSE prospect_preparation_jobs.attempts END,
     available_at=CASE WHEN prospect_preparation_jobs.status='done' AND NOT EXISTS(
       SELECT 1 FROM prospect_preparation_jobs downstream
       WHERE downstream.prospect_id=EXCLUDED.prospect_id
         AND downstream.stage IN ('analysis','contact')
         AND downstream.status IN ('pending','retry','waiting','processing','needs-review')
     ) THEN NOW() ELSE prospect_preparation_jobs.available_at END,
     last_error=CASE WHEN prospect_preparation_jobs.status='done' AND NOT EXISTS(
       SELECT 1 FROM prospect_preparation_jobs downstream
       WHERE downstream.prospect_id=EXCLUDED.prospect_id
         AND downstream.stage IN ('analysis','contact')
         AND downstream.status IN ('pending','retry','waiting','processing','needs-review')
     ) THEN '' ELSE prospect_preparation_jobs.last_error END,
     updated_at=NOW()
   RETURNING id`,[payload]);return r.rows.length;
}
export async function enqueueNext(pool,job,stage,payload={}){
 if(!PREPARATION_STAGES.includes(stage))throw Error('invalid-stage');
 await pool.query(`INSERT INTO prospect_preparation_jobs(id,prospect_id,stage,priority,payload) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(prospect_id,stage) DO NOTHING`,[crypto.randomUUID(),job.prospectId,stage,job.priority,JSON.stringify(payload)]);
}
export async function claimPreparation(pool,stage){
 if(!PREPARATION_STAGES.includes(stage))throw Error('invalid-stage');const lease=crypto.randomUUID();
 const r=await pool.query(`WITH next AS (SELECT id FROM prospect_preparation_jobs WHERE stage=$1 AND attempts<3 AND available_at<=NOW() AND (status IN ('pending','retry','waiting') OR (status='processing' AND lease_until<NOW())) ORDER BY priority DESC,available_at,id FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE prospect_preparation_jobs j SET status='processing',lease_id=$2,lease_until=NOW()+INTERVAL '5 minutes',attempts=attempts+1,updated_at=NOW() FROM next WHERE j.id=next.id RETURNING j.id,j.prospect_id AS "prospectId",j.stage,j.priority,j.attempts,j.lease_id AS "leaseId",j.payload`,[stage,lease]);return r.rows[0]||null;
}
export async function finishPreparation(pool,job,{status='done',reason='',delaySeconds=0,payload=job.payload,refundAttempt=false}={}){
 const r=await pool.query(`UPDATE prospect_preparation_jobs SET status=$3,last_error=$4,payload=$5::jsonb,available_at=NOW()+($6::int*INTERVAL '1 second'),lease_id=NULL,lease_until=NULL,attempts=GREATEST(0,attempts-$7),updated_at=NOW() WHERE id=$1 AND lease_id=$2 AND status='processing' RETURNING id`,[job.id,job.leaseId,status,String(reason).slice(0,180),JSON.stringify(payload||{}),Math.max(0,Math.floor(delaySeconds)),refundAttempt?1:0]);if(!r.rows.length)throw Error('preparation-lease-lost');
}
export async function reservePreparationAI(pool,job,{dailyLimit=50}={}){
 const tx=await pool.connect();try{
  await tx.query('BEGIN');await tx.query("SELECT pg_advisory_xact_lock(741852965)");
  const used=Number((await tx.query(`SELECT count(*)::int AS used FROM preparation_ai_attempts WHERE created_at>=((NOW() AT TIME ZONE 'Europe/Istanbul')::date::timestamp AT TIME ZONE 'Europe/Istanbul')`)).rows[0]?.used||0);
  if(used>=Math.max(0,Math.min(50,dailyLimit))){await tx.query('COMMIT');return false}
  const valid=(await tx.query("SELECT id FROM prospect_preparation_jobs WHERE id=$1 AND lease_id=$2 AND status='processing' AND lease_until>NOW() FOR UPDATE",[job.id,job.leaseId])).rows.length;if(!valid)throw Error('preparation-lease-lost');
  await tx.query('INSERT INTO preparation_ai_attempts(id,job_id) VALUES($1,$2)',[crypto.randomUUID(),job.id]);await tx.query('COMMIT');return true;
 }catch(e){await tx.query('ROLLBACK').catch(()=>{});throw e}finally{tx.release()}
}
export async function preparationStatus(){
 const pool=await preparationPool();
 // Exhausted crash leases are visible for review, never silently disappear.
 await pool.query("UPDATE prospect_preparation_jobs SET status='needs-review',last_error='worker-interrupted-three-times',lease_id=NULL,lease_until=NULL,updated_at=NOW() WHERE status='processing' AND lease_until<NOW() AND attempts>=3");
 const counts=(await pool.query('SELECT stage,status,count(*)::int AS count FROM prospect_preparation_jobs GROUP BY stage,status')).rows;
 const recent=(await pool.query(`SELECT j.id,j.stage,j.status,j.attempts,j.last_error AS reason,j.available_at AS "availableAt",j.updated_at AS "updatedAt",p.name FROM prospect_preparation_jobs j LEFT JOIN prospects p ON p.id=j.prospect_id WHERE j.status<>'done' ORDER BY CASE WHEN j.status='needs-review' THEN 0 ELSE 1 END,j.updated_at DESC LIMIT 12`)).rows;
 const aiAttempts=Number((await pool.query(`SELECT count(*)::int AS count FROM preparation_ai_attempts WHERE created_at>=((NOW() AT TIME ZONE 'Europe/Istanbul')::date::timestamp AT TIME ZONE 'Europe/Istanbul')`)).rows[0]?.count||0);
 return {counts,recent,aiAttempts,dailyAnalysisLimit:50,asOf:new Date().toISOString(),policy:{preflight:10,analysis:3,contact:5,workerBudgetSeconds:60,additionalService:false}};
}
