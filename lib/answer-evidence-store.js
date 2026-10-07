import {implementationAnswerOptions} from './answer-evidence-work-rules.js';
import {compareAnswerEvidence} from './answer-evidence-comparison';
import {databasePool,initializeSchema} from './database-runtime';
import {getDatabaseUrl} from './db';
import {collectAnswerEvidence,answerProviders} from './answer-evidence-providers';
import {refreshBudgetGuard} from './agent-coordination';
export async function answerPool(){
 const url=getDatabaseUrl();if(!url)throw Error('database-required');const pool=databasePool(url);
 await initializeSchema(pool,'answer-evidence-v5',async tx=>{
  await tx.query(`CREATE TABLE IF NOT EXISTS answer_evidence_runs(id UUID PRIMARY KEY,entity_type TEXT NOT NULL,entity_id UUID NOT NULL,entity_name TEXT NOT NULL,domain TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),result JSONB NOT NULL)`);
  await tx.query('CREATE INDEX IF NOT EXISTS answer_evidence_entity_date ON answer_evidence_runs(entity_type,entity_id,created_at DESC)');
  await tx.query('CREATE INDEX IF NOT EXISTS answer_evidence_date ON answer_evidence_runs(created_at DESC)');
  await tx.query(`CREATE TABLE IF NOT EXISTS answer_evidence_automation_slots(slot TIMESTAMPTZ PRIMARY KEY,entity_id UUID NOT NULL,kind TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'claimed',run_id UUID,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await tx.query("ALTER TABLE answer_evidence_automation_slots ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT ''");
  await tx.query("ALTER TABLE answer_evidence_automation_slots ADD COLUMN IF NOT EXISTS entity_type TEXT NOT NULL DEFAULT 'prospect'");
  await tx.query('CREATE INDEX IF NOT EXISTS answer_evidence_automation_entity_date ON answer_evidence_automation_slots(entity_id,created_at DESC)');
 });return pool;
}
export async function listAnswerEvidence({entityType,entityId}={}){
 const pool=await answerPool();return (await pool.query(`SELECT id,entity_type AS "entityType",entity_id AS "entityId",entity_name AS "entityName",domain,created_at AS "createdAt",result FROM answer_evidence_runs WHERE ($1::text IS NULL OR entity_type=$1) AND ($2::uuid IS NULL OR entity_id=$2) ORDER BY created_at DESC LIMIT 20`,[entityType||null,entityId||null])).rows;
}
export async function getAnswerEvidenceRun(id){const pool=await answerPool();return (await pool.query('SELECT id,entity_type AS "entityType",entity_id AS "entityId",entity_name AS "entityName",domain,created_at AS "createdAt",result FROM answer_evidence_runs WHERE id=$1',[id])).rows[0]||null}
export async function measureAnswerEvidence(entity,options={},deps={}){
 const pool=deps.pool||await answerPool(),guard=await (deps.guard||refreshBudgetGuard)();if(guard.mode==='emergency')return {skipped:'ai-budget-exhausted'};
 const tx=await pool.connect();let transaction=false;
 try{
  await tx.query('BEGIN');transaction=true;
  const key=entity.entityType+':'+entity.id;
  const lock=(await tx.query('SELECT pg_try_advisory_xact_lock(hashtextextended($1,741852991)) AS acquired',[key])).rows[0]?.acquired;
  if(!lock)return {skipped:'already-running'};
  const previous=(await tx.query(`SELECT id FROM answer_evidence_runs WHERE entity_type=$1 AND entity_id=$2 AND created_at>NOW()-($3::int*INTERVAL '1 minute') LIMIT 1`,[entity.entityType,entity.id,options.automaticRepeat?1440:15])).rows[0];
  if(previous)return {skipped:'recent-run',id:previous.id};
  let history=(await tx.query('SELECT id,entity_type AS "entityType",entity_id AS "entityId",entity_name AS "entityName",domain,created_at AS "createdAt",result FROM answer_evidence_runs WHERE entity_type=$1 AND entity_id=$2 ORDER BY created_at DESC LIMIT 20',[entity.entityType,entity.id])).rows;
  if(options.implementationWorkId){
   if(entity.entityType!=='client')return {skipped:'implementation-not-eligible'};
   const work=(await tx.query(`SELECT NOW() AS "serverNow",w.id,w.client_id AS "clientId",w.title,w.status,w.completion_evidence AS "completionEvidence",w.evidence_url AS "evidenceUrl",w.evidence_recorded_at AS "evidenceRecordedAt",c.name AS "clientName",c.domain AS "clientDomain",c.status AS "clientStatus",EXISTS(SELECT 1 FROM payments p WHERE p.client_id=c.id AND p.status='paid' AND COALESCE(p.terms_version,'') NOT LIKE 'test-flow-%') AS paid FROM work_items w JOIN clients c ON c.id=w.client_id WHERE w.id=$1 AND w.client_id=$2 FOR SHARE OF w,c`,[options.implementationWorkId,entity.id])).rows[0];
   const baseline=(await tx.query('SELECT id,entity_type AS "entityType",entity_id AS "entityId",entity_name AS "entityName",domain,created_at AS "createdAt",result FROM answer_evidence_runs WHERE id=$1 AND entity_type=$2 AND entity_id=$3',[options.repeatRunId,'client',entity.id])).rows[0];
   const linked=(await tx.query("SELECT id FROM answer_evidence_runs WHERE entity_type='client' AND entity_id=$1 AND result->'implementationContext'->>'workId'=$2 LIMIT 1",[entity.id,options.implementationWorkId])).rows[0];
   if(linked)return {skipped:'implementation-already-measured',id:linked.id};
   try{options=implementationAnswerOptions({...entity,name:work?.clientName,domain:work?.clientDomain,status:work?.clientStatus,paid:work?.paid},baseline,work||{},{providers:(deps.providers||answerProviders)(),now:work?.serverNow})}catch{return {skipped:'implementation-not-eligible'}}
   history=[baseline];
  }
  const result=await (deps.collect||collectAnswerEvidence)(entity,options);
  result.comparison=compareAnswerEvidence(entity,result,history);
  if(options.repeatRunId)result.repeatRunId=options.repeatRunId;
  if(options.implementationWorkId&&options.implementationContext)result.implementationContext=options.implementationContext;
  if(options.automationKind)result.automationKind=options.automationKind;
  if(options.measurementOrigin)result.measurementOrigin=options.measurementOrigin;
  const id=crypto.randomUUID();
  const row=(await tx.query(`INSERT INTO answer_evidence_runs(id,entity_type,entity_id,entity_name,domain,result) VALUES($1,$2,$3,$4,$5,$6::jsonb) RETURNING id,created_at AS "createdAt"`,[id,entity.entityType,entity.id,entity.name,entity.domain||'',JSON.stringify(result)])).rows[0];
  if(!row)throw Error('answer-evidence-not-persisted');
  await tx.query('COMMIT');transaction=false;return {...row,result};
 }finally{let destroy=false;if(transaction){try{await tx.query('ROLLBACK')}catch{destroy=true}}tx.release(destroy)}
}

export async function measureProspectAnswerEvidence(prospect){
 const available=answerProviders(),provider=available.includes('Perplexity')?'Perplexity':available[0];
 if(!provider||!prospect.sector||!(prospect.city||prospect.country))return {skipped:'query-context-unavailable'};
 return measureAnswerEvidence({...prospect,entityType:'prospect'},{providers:[provider],language:/^(Türkiye|Turkey|TR)$/i.test(prospect.country||'')?'tr':'en'});
}
