import {implementationAnswerOptions} from './answer-evidence-work-rules.js';
import {ensureWorkEvidence} from './work-evidence';
export async function listImplementationAnswerPlans(pool,providers,clientId=null){
 await ensureWorkEvidence(pool);
 const rows=(await pool.query(`SELECT NOW() AS "serverNow",c.id,c.name,c.domain,c.status,TRUE AS paid,w.id AS "workId",w.title,w.status AS "workStatus",w.completion_evidence AS "completionEvidence",w.evidence_url AS "evidenceUrl",w.evidence_recorded_at AS "evidenceRecordedAt",b.id AS "baselineId",b.entity_name AS "baselineName",b.domain AS "baselineDomain",b.created_at AS "baselineAt",b.result
 FROM clients c JOIN work_items w ON w.client_id=c.id
 JOIN LATERAL(SELECT * FROM answer_evidence_runs a WHERE a.entity_type='client' AND a.entity_id=c.id AND a.created_at<w.evidence_recorded_at
 AND jsonb_array_length(COALESCE(a.result->'queries','[]'::jsonb))=1 AND jsonb_array_length(COALESCE(a.result->'observations','[]'::jsonb))=1
 AND jsonb_array_length(COALESCE(a.result->'errors','[]'::jsonb))=0 AND a.result->'summary'->>'neutralComplete'='1' ORDER BY a.created_at DESC LIMIT 1)b ON TRUE
 WHERE ($1::uuid IS NULL OR c.id=$1) AND c.status='active' AND c.domain NOT LIKE '%.local'
 AND EXISTS(SELECT 1 FROM payments payment WHERE payment.client_id=c.id AND payment.status='paid' AND COALESCE(payment.terms_version,'') NOT LIKE 'test-flow-%')
 AND w.status='completed' AND length(trim(w.completion_evidence))>=20 AND w.evidence_recorded_at<=NOW()-INTERVAL '24 hours'
 AND NOT EXISTS(SELECT 1 FROM answer_evidence_runs a WHERE a.entity_type='client' AND a.entity_id=c.id AND (a.created_at>NOW()-INTERVAL '24 hours' OR a.result->'implementationContext'->>'workId'=w.id::text))
 AND NOT EXISTS(SELECT 1 FROM answer_evidence_automation_slots s WHERE s.entity_type='client' AND s.entity_id=c.id AND s.created_at>NOW()-INTERVAL '24 hours')
 ORDER BY w.evidence_recorded_at ASC,w.id LIMIT 20`,[clientId])).rows;
 const plans=[];for(const x of rows){const entity={id:x.id,name:x.name,domain:x.domain,status:x.status,paid:x.paid,entityType:'client'},baseline={id:x.baselineId,entityId:x.id,entityType:'client',entityName:x.baselineName,domain:x.baselineDomain,createdAt:x.baselineAt,result:x.result},work={id:x.workId,clientId:x.id,title:x.title,status:x.workStatus,completionEvidence:x.completionEvidence,evidenceRecordedAt:x.evidenceRecordedAt,evidenceUrl:x.evidenceUrl};try{plans.push({entity,options:implementationAnswerOptions(entity,baseline,work,{providers,now:x.serverNow}),kind:'repeat'})}catch{}}
 return plans;
}
