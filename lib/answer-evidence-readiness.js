import {ensureWorkEvidence} from './work-evidence';
import {summarizeImplementationReadiness} from './answer-evidence-readiness-rules.js';
export async function listImplementationReadiness(pool,providers,clientId,now){
 await ensureWorkEvidence(pool);
 const rows=(await pool.query(`SELECT c.id,c.name,c.domain,c.status,w.id AS "workId",w.title,w.status AS "workStatus",w.completion_evidence AS "completionEvidence",w.evidence_recorded_at AS "evidenceRecordedAt",
 EXISTS(SELECT 1 FROM payments p WHERE p.client_id=c.id AND p.status='paid' AND COALESCE(p.terms_version,'') NOT LIKE 'test-flow-%') AS paid,
 b.id AS "baselineId",b.entity_name AS "baselineName",b.domain AS "baselineDomain",b.created_at AS "baselineAt",b.result AS "baselineResult",
 f.id AS "followupId",COALESCE((f.result->'summary'->>'neutralComplete')::int=1 AND jsonb_array_length(COALESCE(f.result->'errors','[]'::jsonb))=0 AND jsonb_array_length(COALESCE(f.result->'comparison'->'pairs','[]'::jsonb))=1,FALSE) AS "followupComplete",
 GREATEST((SELECT MAX(a.created_at) FROM answer_evidence_runs a WHERE a.entity_type='client' AND a.entity_id=c.id),(SELECT MAX(s.created_at) FROM answer_evidence_automation_slots s WHERE s.entity_type='client' AND s.entity_id=c.id)) AS "lastAttemptAt"
 FROM clients c JOIN work_items w ON w.client_id=c.id
 LEFT JOIN LATERAL(SELECT a.id,a.entity_name,a.domain,a.created_at,jsonb_build_object('queries',a.result->'queries','errors',a.result->'errors','observations',jsonb_build_array(jsonb_build_object('provider',a.result->'observations'->0->'provider','query',a.result->'observations'->0->'query','model',a.result->'observations'->0->'model','mode',a.result->'observations'->0->'mode','brandPrompted',a.result->'observations'->0->'brandPrompted','truncated',a.result->'observations'->0->'truncated','checkedAt',a.result->'observations'->0->'checkedAt'))) AS result FROM answer_evidence_runs a WHERE a.entity_type='client' AND a.entity_id=c.id AND (w.status<>'completed' OR a.created_at<w.evidence_recorded_at)
 AND jsonb_array_length(COALESCE(a.result->'queries','[]'::jsonb))=1 AND jsonb_array_length(COALESCE(a.result->'observations','[]'::jsonb))=1 AND jsonb_array_length(COALESCE(a.result->'errors','[]'::jsonb))=0 AND a.result->'summary'->>'neutralComplete'='1' ORDER BY a.created_at DESC LIMIT 1)b ON TRUE
 LEFT JOIN LATERAL(SELECT a.id,a.result FROM answer_evidence_runs a WHERE a.entity_type='client' AND a.entity_id=c.id AND a.result->'implementationContext'->>'workId'=w.id::text ORDER BY a.created_at DESC LIMIT 1)f ON TRUE
 WHERE ($1::uuid IS NULL OR c.id=$1) ORDER BY w.updated_at DESC,w.id LIMIT 101`,[clientId||null])).rows;
 return summarizeImplementationReadiness(rows.map(x=>({...x,baseline:x.baselineId?{id:x.baselineId,entityType:'client',entityId:x.id,entityName:x.baselineName,domain:x.baselineDomain,createdAt:x.baselineAt,result:x.baselineResult}:null})),providers,now);
}
