import {answerPool} from './answer-evidence-store';
import {answerProviders} from './answer-evidence-providers';
import {summarizeEvidenceStatus} from './answer-evidence-status-rules.js';
export async function answerEvidenceStatus({entityType,entityId}={},deps={}){
 if(entityType==='client')return {supported:false,scope:'Otomatik yanıt örneği ve tekrar ölçümü şu anda işletme adayları için çalışır. Müşteriler bu ekranda yönetici tarafından ölçülebilir.'};
 const pool=deps.pool||await answerPool();
 const [snapshot,slots,clock]=await Promise.all([
 pool.query(`WITH latest AS (SELECT DISTINCT ON(entity_id) entity_id,created_at FROM answer_evidence_runs WHERE entity_type='prospect' ORDER BY entity_id,created_at DESC)
 SELECT NOW() AS "serverNow",p.id,p.name,p.domain,p.client_id AS "clientId",p.crm_stage AS "crmStage",GREATEST(latest.created_at,s.created_at) AS "lastAttemptAt",b.id AS "baselineId",b.entity_name AS "baselineName",b.domain AS "baselineDomain",
 CASE WHEN b.id IS NULL THEN NULL ELSE jsonb_build_object('queries',b.result->'queries','errors','[]'::jsonb,'observations',jsonb_build_array(jsonb_build_object('provider',b.result->'observations'->0->'provider','model',b.result->'observations'->0->'model','mode',b.result->'observations'->0->'mode','brandPrompted',b.result->'observations'->0->'brandPrompted','truncated',b.result->'observations'->0->'truncated'))) END AS baseline
 FROM latest JOIN prospects p ON p.id=latest.entity_id
 LEFT JOIN LATERAL(SELECT * FROM answer_evidence_runs a WHERE a.entity_type='prospect' AND a.entity_id=p.id AND jsonb_array_length(COALESCE(a.result->'queries','[]'::jsonb))=1 AND jsonb_array_length(COALESCE(a.result->'observations','[]'::jsonb))=1 AND jsonb_array_length(COALESCE(a.result->'errors','[]'::jsonb))=0 AND a.result->'summary'->>'neutralComplete'='1' ORDER BY a.created_at DESC LIMIT 1)b ON TRUE
 LEFT JOIN LATERAL(SELECT MAX(created_at) AS created_at FROM answer_evidence_automation_slots WHERE entity_id=p.id)s ON TRUE
 WHERE ($1::uuid IS NULL OR p.id=$1) ORDER BY latest.created_at ASC,p.id LIMIT 1001`,[entityId||null]),
 pool.query(`SELECT NOW() AS "serverNow",s.slot,s.created_at AS "createdAt",s.status,s.kind,s.run_id AS "runId",s.entity_id AS "entityId",s.reason,p.name AS "entityName",s.slot=date_trunc('hour',NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AS "currentHour" FROM answer_evidence_automation_slots s LEFT JOIN prospects p ON p.id=s.entity_id WHERE ($1::uuid IS NULL OR s.entity_id=$1) ORDER BY s.slot DESC LIMIT 10`,[entityId||null]),
 pool.query(`SELECT NOW() AS "serverNow",EXISTS(SELECT 1 FROM answer_evidence_automation_slots WHERE slot=date_trunc('hour',NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS "hourlyUsed",(date_trunc('hour',NOW() AT TIME ZONE 'UTC')+INTERVAL '1 hour') AT TIME ZONE 'UTC' AS "nextHourAt"`)]);
 const now=clock.rows[0]?.serverNow;if(!now)throw Error('evidence-status-clock-unavailable');
 const rows=snapshot.rows.slice(0,1000).map(x=>({entity:{id:x.id,name:x.name,domain:x.domain,clientId:x.clientId,crmStage:x.crmStage},lastAttemptAt:x.lastAttemptAt,run:x.baselineId?{id:x.baselineId,entityType:'prospect',entityId:x.id,entityName:x.baselineName,domain:x.baselineDomain,result:x.baseline}:null}));
 return {supported:true,hourlyUsed:clock.rows[0].hourlyUsed,nextHourAt:clock.rows[0].nextHourAt,scope:entityId?'Seçili adayın kayıtlı yanıtları ve otomatik ölçüm denemeleri.':'Yanıt kaydı bulunan adaylar; henüz yanıt örneği alınmamış adaylar bu sayımlara dahil değildir.',...summarizeEvidenceStatus(rows,(deps.providers||answerProviders)(),now),limited:snapshot.rows.length>1000,serverNow:now,attempts:slots.rows.map(({serverNow,...x})=>x)};
}
