import crypto from 'node:crypto';
import {initializeSchema} from './database-runtime';
export async function ensureWorkEvidence(pool){
 await initializeSchema(pool,'work-completion-evidence-v1',tx=>tx.query(`ALTER TABLE work_items
 ADD COLUMN IF NOT EXISTS completion_evidence TEXT NOT NULL DEFAULT '',
 ADD COLUMN IF NOT EXISTS evidence_url TEXT NOT NULL DEFAULT '',
 ADD COLUMN IF NOT EXISTS evidence_recorded_at TIMESTAMPTZ`));
}
export function completionEvidence(input={}){
 const detail=typeof input.detail==='string'?input.detail.trim():'',url=typeof input.url==='string'?input.url.trim():'';
 if(input.confirmed!==true||detail.length<20||detail.length>4000||url.length>2000)throw Error('completion-evidence-required');
 if(url){let parsed;try{parsed=new URL(url)}catch{throw Error('invalid-evidence-url')};if(parsed.protocol!=='https:'||parsed.username||parsed.password)throw Error('invalid-evidence-url')}
 return {detail,url};
}
export async function updateWorkWithEvidence(pool,id,status,input={},expectedStatus){
 if(!['ready','access-required','approval-required','in-progress','completed'].includes(status))throw Error('invalid-work-status');
 if(!expectedStatus)throw Error('work-version-required');
 const evidence=status==='completed'?completionEvidence(input):null;
 const tx=await pool.connect();
 try{
  await tx.query('BEGIN');const previous=(await tx.query('SELECT * FROM work_items WHERE id=$1 FOR UPDATE',[id])).rows[0];
  if(!previous){await tx.query('COMMIT');return null}
  if(previous.status!==expectedStatus)throw Error('work-changed');
  if(previous.status===status){await tx.query('COMMIT');return {id,status,unchanged:true}}
  if(status==='completed'){
   if(previous.status!=='in-progress')throw Error('work-not-in-progress');
   const eligible=(await tx.query(`SELECT c.id FROM clients c WHERE c.id=$1 AND c.status='active' AND c.domain NOT LIKE '%.local'
    AND EXISTS(SELECT 1 FROM payments p WHERE p.client_id=c.id AND p.status='paid' AND COALESCE(p.terms_version,'') NOT LIKE 'test-flow-%') FOR UPDATE OF c`,[previous.client_id])).rows[0];
   if(!eligible)throw Error('paid-real-client-required');
  }
  const row=(await tx.query(`UPDATE work_items SET status=$2,updated_at=NOW(),completion_evidence=$3,evidence_url=$4,evidence_recorded_at=CASE WHEN $2='completed' THEN NOW() ELSE NULL END WHERE id=$1
   RETURNING id,client_id AS "clientId",title,category,status,detail,source,completion_evidence AS "completionEvidence",evidence_url AS "evidenceUrl",evidence_recorded_at AS "evidenceRecordedAt"`,[id,status,evidence?.detail||'',evidence?.url||''])).rows[0];
  await tx.query(`INSERT INTO client_activity(id,client_id,event_type,title,detail,metadata) VALUES($1,$2,'implementation','Uygulama görevi güncellendi',$3,$4::jsonb)`,[crypto.randomUUID(),previous.client_id,evidence?.detail||`${previous.title}: ${previous.status} → ${status}`,JSON.stringify({workId:id,previousStatus:previous.status,status,evidenceUrl:evidence?.url||'',verification:status==='completed'?'admin-attested':'status-change',previousEvidence:previous.completion_evidence||'',previousEvidenceUrl:previous.evidence_url||''})]);
  await tx.query('COMMIT');return row;
 }catch(e){await tx.query('ROLLBACK').catch(()=>{});throw e}finally{tx.release()}
}
