// Fixed projection only. Never import schema-initializing repository helpers here.
export const REAL_AUDIT_SQL=`WITH event_candidates AS (
 SELECT status,created_at FROM public.agent_shared_board
 WHERE created_at>=NOW()-INTERVAL '7 days' AND created_at<=NOW()
 ORDER BY created_at DESC LIMIT 201
), event_sample AS (SELECT * FROM event_candidates ORDER BY created_at DESC LIMIT 200),
cost_candidates AS (
 SELECT amount,currency,estimated,metadata->>'pricingSource' AS pricing_source,created_at
 FROM public.cost_ledger WHERE created_at>=NOW()-INTERVAL '7 days' AND created_at<=NOW()
 ORDER BY created_at DESC LIMIT 201
), cost_sample AS (SELECT * FROM cost_candidates ORDER BY created_at DESC LIMIT 200)
SELECT NOW() AS "checkedAt",
 (SELECT COUNT(*)::int FROM event_sample) AS "eventCount",
 (SELECT COUNT(*)>200 FROM event_candidates) AS "eventLimited",
 (SELECT MAX(created_at) FROM event_sample) AS "latestEventAt",
 (SELECT COUNT(*)::int FROM event_sample WHERE status='completed') AS "completedCount",
 (SELECT COUNT(*)::int FROM event_sample WHERE status IN ('failed','error','needs-attention')) AS "attentionCount",
 (SELECT COUNT(*)::int FROM event_sample WHERE status IS NULL OR status NOT IN ('completed','failed','error','needs-attention')) AS "otherCount",
 (SELECT COUNT(*)::int FROM cost_sample) AS "costCount",
 (SELECT COUNT(*)>200 FROM cost_candidates) AS "costLimited",
 (SELECT COUNT(*)::int FROM cost_sample WHERE estimated IS TRUE) AS "estimatedCostCount",
 (SELECT COUNT(*)::int FROM cost_sample WHERE estimated IS NULL OR pricing_source='unconfigured-zero' OR amount IS NULL OR amount<0 OR amount::text IN ('NaN','Infinity','-Infinity')) AS "unknownCostCount"`;

export const REAL_AUDIT_VIEW_SQL='SELECT * FROM rd_audit.real_record_summary';
const count=v=>Number.isInteger(v)&&v>=0&&v<=200;
const time=v=>v instanceof Date?v.toISOString():v;
export function normalizeRealAudit(row){
 if(!row||!['eventCount','completedCount','attentionCount','otherCount','costCount','estimatedCostCount','unknownCostCount'].every(k=>count(row[k]))||
  typeof row.eventLimited!=='boolean'||typeof row.costLimited!=='boolean'||
  row.completedCount+row.attentionCount+row.otherCount!==row.eventCount||row.estimatedCostCount>row.costCount||row.unknownCostCount>row.costCount)
  throw Error('invalid-audit-aggregate');
 const checkedAt=time(row.checkedAt),latestEventAt=time(row.latestEventAt);
 if(!Number.isFinite(Date.parse(checkedAt))||(latestEventAt!==null&&(!Number.isFinite(Date.parse(latestEventAt))||Date.parse(latestEventAt)>Date.parse(checkedAt))))throw Error('invalid-audit-time');
 return {scope:'admin-only-real-record-sample',checkedAt,windowDays:7,sampleLimit:200,
  events:{count:row.eventCount,limited:row.eventLimited,latestAt:latestEventAt,completed:row.completedCount,attention:row.attentionCount,other:row.otherCount},
  costs:{count:row.costCount,limited:row.costLimited,estimated:row.estimatedCostCount,unknown:row.unknownCostCount,actualTotal:null},
  transactionReadOnly:true,dedicatedReaderRole:false,connectionRoleIsDedicated:false,rawEventContentIncluded:false,
  externalActions:false,persistentAudit:false,customerAcceptance:false};
}

export async function readRealAudit(pool){
 const tx=await pool.connect();let discard=false;
 try{
  await tx.query('BEGIN READ ONLY');
  await tx.query("SET LOCAL statement_timeout='3000ms'");
  await tx.query('SET LOCAL ROLE rd_audit_reader');
  const mode=await tx.query("SELECT current_setting('transaction_read_only') AS mode,current_user AS role");
  if(mode.rows[0]?.mode!=='on'||mode.rows[0]?.role!=='rd_audit_reader')throw Error('read-only-not-confirmed');
  const result=await tx.query(REAL_AUDIT_VIEW_SQL);
  if(result.rows.length!==1)throw Error('invalid-audit-aggregate');
  const summary=normalizeRealAudit(result.rows[0]);
  summary.dedicatedReaderRole=true;
  await tx.query('COMMIT');return summary;
 }catch{
  try{await tx.query('ROLLBACK')}catch{discard=true}
  throw Error('real-audit-unavailable');
 }finally{tx.release(discard)}
}
