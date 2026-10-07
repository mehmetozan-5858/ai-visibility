import {answerPool,measureAnswerEvidence} from './answer-evidence-store';
import {answerProviders} from './answer-evidence-providers';
import {repeatEvidenceOptions} from './answer-evidence-comparison';
import {refreshBudgetGuard} from './agent-coordination';
export function chooseAutomaticEvidence({due=[],fresh=[],providers=[],slot=0}={}){
 const repeats=[];
 for(const row of due){
  const entity={...row.entity,entityType:'prospect'};
  try{const options=repeatEvidenceOptions(entity,row.run,providers),observations=row.run.result.observations||[];
   if(options.queries.length!==1||options.providers.length!==1||!observations.some(x=>x.brandPrompted===false&&x.truncated===false&&x.model&&x.mode))continue;
   repeats.push({entity,options:{...options,automaticRepeat:true,automationKind:'repeat'},kind:'repeat'});
  }catch{}
 }
 const provider=providers.includes('Perplexity')?'Perplexity':providers[0];
 const prospect=fresh.find(x=>x.sector&&(x.city||x.country));
 const first=provider&&prospect?{entity:{...prospect,entityType:'prospect'},options:{providers:[provider],language:/^(Türkiye|Turkey|TR)$/i.test(prospect.country||'')?'tr':'en',automationKind:'first'},kind:'first'}:null;
 // Alternate scarce capacity; when either queue is empty the other can proceed.
 return slot%2===1?(repeats[0]||first):(first||repeats[0])||null;
}
export async function runAutomaticAnswerEvidence(fresh=[],deps={}){
 const guard=await (deps.guard||refreshBudgetGuard)();if(guard.mode==='emergency')return {skipped:'ai-budget-exhausted'};
 const pool=deps.pool||await answerPool(),providers=(deps.providers||answerProviders)();if(!providers.length)return {skipped:'provider-unavailable'};
 const rows=(await pool.query(`SELECT p.id,p.name,p.domain,p.sector,p.city,p.country,b.id AS "runId",b.entity_name AS "entityName",b.domain AS "runDomain",b.created_at AS "createdAt",b.result
 FROM (SELECT DISTINCT ON (entity_id) entity_id,created_at FROM answer_evidence_runs WHERE entity_type='prospect' ORDER BY entity_id,created_at DESC) latest
 JOIN prospects p ON p.id=latest.entity_id
 JOIN LATERAL (SELECT * FROM answer_evidence_runs a WHERE a.entity_type='prospect' AND a.entity_id=p.id
 AND jsonb_array_length(COALESCE(a.result->'queries','[]'::jsonb))=1 AND jsonb_array_length(COALESCE(a.result->'observations','[]'::jsonb))=1
 AND jsonb_array_length(COALESCE(a.result->'errors','[]'::jsonb))=0 AND a.result->'summary'->>'neutralComplete'='1' ORDER BY a.created_at DESC LIMIT 1) b ON TRUE
 WHERE latest.created_at<=NOW()-INTERVAL '24 hours'
 AND NOT EXISTS(SELECT 1 FROM answer_evidence_automation_slots s WHERE s.entity_id=p.id AND s.created_at>NOW()-INTERVAL '24 hours') AND p.client_id IS NULL AND p.crm_stage NOT IN ('lost','won')
 AND p.name=b.entity_name AND lower(trim(p.domain))=lower(trim(b.domain))
 AND b.result->'observations'->0->>'provider'=ANY($1::text[])
 ORDER BY latest.created_at ASC,p.id LIMIT 20`,[providers])).rows;
 const due=rows.map(x=>({entity:{id:x.id,name:x.name,domain:x.domain,sector:x.sector,city:x.city,country:x.country},run:{id:x.runId,entityType:'prospect',entityId:x.id,entityName:x.entityName,domain:x.runDomain,createdAt:x.createdAt,result:x.result}}));
 // Database time determines the shared hour; application clocks cannot create extra slots.
 const clock=(await pool.query("SELECT FLOOR(EXTRACT(EPOCH FROM NOW())/3600)::bigint AS hour")).rows[0];
 const selected=chooseAutomaticEvidence({due,fresh,providers,slot:Number(clock?.hour||0)});if(!selected)return {skipped:'no-eligible-evidence'};
 const claimed=(await pool.query(`INSERT INTO answer_evidence_automation_slots(slot,entity_id,kind) VALUES(date_trunc('hour',NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC',$1,$2) ON CONFLICT(slot) DO NOTHING RETURNING slot`,[selected.entity.id,selected.kind])).rows[0];
 if(!claimed)return {skipped:'hourly-evidence-slot-used'};
 try{
  const run=await (deps.measure||measureAnswerEvidence)(selected.entity,selected.options);
  let auditSaved=true;try{await pool.query('UPDATE answer_evidence_automation_slots SET status=$2,run_id=$3 WHERE slot=$1',[claimed.slot,run.skipped?'skipped':run.result?.errors?.length?'needs-attention':'completed',run.id||null])}catch{auditSaved=false}
  return {...run,kind:selected.kind,entityId:selected.entity.id,entityName:selected.entity.name,slotAuditSaved:auditSaved};
 }catch(error){try{await pool.query("UPDATE answer_evidence_automation_slots SET status='failed' WHERE slot=$1",[claimed.slot])}catch{}throw error}
}
