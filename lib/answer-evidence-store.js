import {databasePool,initializeSchema} from './database-runtime';
import {getDatabaseUrl} from './db';
import {collectAnswerEvidence,answerProviders} from './answer-evidence-providers';
import {refreshBudgetGuard} from './agent-coordination';
async function answerPool(){
 const url=getDatabaseUrl();if(!url)throw Error('database-required');const pool=databasePool(url);
 await initializeSchema(pool,'answer-evidence-v1',async tx=>{
  await tx.query(`CREATE TABLE IF NOT EXISTS answer_evidence_runs(id UUID PRIMARY KEY,entity_type TEXT NOT NULL,entity_id UUID NOT NULL,entity_name TEXT NOT NULL,domain TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),result JSONB NOT NULL)`);
  await tx.query('CREATE INDEX IF NOT EXISTS answer_evidence_entity_date ON answer_evidence_runs(entity_type,entity_id,created_at DESC)');
 });return pool;
}
export async function listAnswerEvidence({entityType,entityId}={}){
 const pool=await answerPool();return (await pool.query(`SELECT id,entity_type AS "entityType",entity_id AS "entityId",entity_name AS "entityName",domain,created_at AS "createdAt",result FROM answer_evidence_runs WHERE ($1::text IS NULL OR entity_type=$1) AND ($2::uuid IS NULL OR entity_id=$2) ORDER BY created_at DESC LIMIT 20`,[entityType||null,entityId||null])).rows;
}
export async function measureAnswerEvidence(entity,options={},deps={}){
 const pool=deps.pool||await answerPool(),guard=await (deps.guard||refreshBudgetGuard)();if(guard.mode==='emergency')return {skipped:'ai-budget-exhausted'};
 const tx=await pool.connect();let transaction=false;
 try{
  await tx.query('BEGIN');transaction=true;
  const key=entity.entityType+':'+entity.id;
  const lock=(await tx.query('SELECT pg_try_advisory_xact_lock(hashtextextended($1,741852991)) AS acquired',[key])).rows[0]?.acquired;
  if(!lock)return {skipped:'already-running'};
  const previous=(await tx.query(`SELECT id FROM answer_evidence_runs WHERE entity_type=$1 AND entity_id=$2 AND created_at>NOW()-INTERVAL '15 minutes' LIMIT 1`,[entity.entityType,entity.id])).rows[0];
  if(previous)return {skipped:'recent-run',id:previous.id};
  const result=await (deps.collect||collectAnswerEvidence)(entity,options);
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
