function finite(v){const n=Number(v);return Number.isFinite(n)?n:0}
function normalizedArm(row,prefix){
 const sent=Math.max(0,Math.floor(finite(row?.[`${prefix}_sent`]))),replied=Math.max(0,Math.floor(finite(row?.[`${prefix}_replied`]))),converted=Math.max(0,Math.floor(finite(row?.[`${prefix}_converted`])));
 return {sent,replied:Math.min(replied,sent),converted:Math.min(converted,sent)};
}
function rate(n,d){return d>0?n/d:0}
function hashBucket(seed){let h=2166136261;for(const ch of String(seed||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)>>>0}return h%10000}
export function scoreSubjectAllocation(stats={}){
 const score=normalizedArm(stats,'score'),curiosity=normalizedArm(stats,'curiosity');
 const scoreReply=rate(score.replied,score.sent),curiosityReply=rate(curiosity.replied,curiosity.sent);
 const scoreConversion=rate(score.converted,score.sent),curiosityConversion=rate(curiosity.converted,curiosity.sent);
 const scoreValue=scoreReply+(scoreConversion*1.5),curiosityValue=curiosityReply+(curiosityConversion*1.5);
 const delta=scoreValue-curiosityValue,minimum=Math.min(score.sent,curiosity.sent);
 let scoreShare=0.5,stage='learning',winner='NONE',reason='minimum-sample';
 if(minimum>=20&&Math.abs(delta)>=0.05){
  winner=delta>0?'SCORE':'CURIOSITY';scoreShare=winner==='SCORE'?0.7:0.3;stage='adaptive-70-30';reason='measured-lift';
 }
 if(minimum>=50&&Math.abs(delta)>=0.1){
  winner=delta>0?'SCORE':'CURIOSITY';scoreShare=winner==='SCORE'?0.8:0.2;stage='adaptive-80-20';reason='strong-measured-lift';
 }
 return {score,curiosity,scoreReplyRate:scoreReply,curiosityReplyRate:curiosityReply,scoreConversionRate:scoreConversion,curiosityConversionRate:curiosityConversion,scoreValue,curiosityValue,delta,scoreShare,curiosityShare:1-scoreShare,stage,winner,reason};
}
export function allocateScoreSubjectVariant(id,plan){
 const share=Math.max(0.2,Math.min(0.8,Number(plan?.scoreShare)||0.5));
 return hashBucket(`adaptive-score-subject:${id}`)<Math.round(share*10000)?'SCORE':'CURIOSITY';
}
export async function loadScoreSubjectAllocation(pool){
 try{
  const tables=(await pool.query("SELECT to_regclass('public.email_deliveries') AS deliveries,to_regclass('public.prospects') AS prospects")).rows[0];
  if(!tables?.deliveries||!tables?.prospects)return scoreSubjectAllocation();
  const row=(await pool.query(`SELECT
   COUNT(*) FILTER(WHERE d.payload->>'html' LIKE '%data-score-subject-variant="SCORE"%' AND d.provider_id<>'' AND d.status IN ('accepted','completed'))::integer AS score_sent,
   COUNT(*) FILTER(WHERE d.payload->>'html' LIKE '%data-score-subject-variant="SCORE"%' AND d.provider_id<>'' AND d.status IN ('accepted','completed') AND COALESCE(p.reply_status,'')<>'')::integer AS score_replied,
   COUNT(*) FILTER(WHERE d.payload->>'html' LIKE '%data-score-subject-variant="SCORE"%' AND d.provider_id<>'' AND d.status IN ('accepted','completed') AND (p.client_id IS NOT NULL OR p.crm_stage='won'))::integer AS score_converted,
   COUNT(*) FILTER(WHERE d.payload->>'html' LIKE '%data-score-subject-variant="CURIOSITY"%' AND d.provider_id<>'' AND d.status IN ('accepted','completed'))::integer AS curiosity_sent,
   COUNT(*) FILTER(WHERE d.payload->>'html' LIKE '%data-score-subject-variant="CURIOSITY"%' AND d.provider_id<>'' AND d.status IN ('accepted','completed') AND COALESCE(p.reply_status,'')<>'')::integer AS curiosity_replied,
   COUNT(*) FILTER(WHERE d.payload->>'html' LIKE '%data-score-subject-variant="CURIOSITY"%' AND d.provider_id<>'' AND d.status IN ('accepted','completed') AND (p.client_id IS NOT NULL OR p.crm_stage='won'))::integer AS curiosity_converted
   FROM email_deliveries d LEFT JOIN prospects p ON p.id::text=split_part(d.delivery_key,'/',2)
   WHERE d.delivery_key LIKE 'prospect-first/%'`)).rows[0]||{};
  return scoreSubjectAllocation(row);
 }catch{return {...scoreSubjectAllocation(),reason:'stats-unavailable'}}
}
