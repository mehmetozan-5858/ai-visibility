import crypto from "node:crypto";
import {getDatabaseUrl} from "./db";
import {personalizeCreatorOutreach,analyzeCreatorReply} from "./providers";

function dbUrl(){return getDatabaseUrl()||""}
async function withDb(fn){const url=dbUrl();if(!url)throw new Error("database-not-configured");const {Pool}=await import("pg");const pool=new Pool({connectionString:url});try{await pool.query(`CREATE TABLE IF NOT EXISTS creator_hunt_leads(
 id UUID PRIMARY KEY, platform TEXT NOT NULL, handle TEXT NOT NULL DEFAULT '', display_name TEXT NOT NULL,
 profile_url TEXT NOT NULL DEFAULT '', niche TEXT NOT NULL DEFAULT '', country TEXT NOT NULL DEFAULT '',
 language TEXT NOT NULL DEFAULT '', public_contact TEXT NOT NULL DEFAULT '', source_url TEXT NOT NULL DEFAULT '',
 opportunity_score INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'new',
 creator_tier TEXT NOT NULL DEFAULT 'emerging', growth_score INTEGER NOT NULL DEFAULT 0, monetization_score INTEGER NOT NULL DEFAULT 0, brand_readiness_score INTEGER NOT NULL DEFAULT 0, ai_discoverability_score INTEGER NOT NULL DEFAULT 0, cross_platform_score INTEGER NOT NULL DEFAULT 0, qualification_level TEXT NOT NULL DEFAULT 'cold', forecast_probability INTEGER NOT NULL DEFAULT 0, next_best_action TEXT NOT NULL DEFAULT '', next_action_priority INTEGER NOT NULL DEFAULT 0, truth_status TEXT NOT NULL DEFAULT 'review', baseline_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb, latest_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb, last_measured_at TIMESTAMPTZ, crm_stage TEXT NOT NULL DEFAULT 'new', proposal_status TEXT NOT NULL DEFAULT 'none', proposal_scope JSONB NOT NULL DEFAULT '{}'::jsonb, next_follow_up DATE, crm_notes TEXT NOT NULL DEFAULT '', outreach_reason TEXT NOT NULL DEFAULT '', outreach_subject TEXT NOT NULL DEFAULT '', outreach_draft TEXT NOT NULL DEFAULT '', audit_focus JSONB NOT NULL DEFAULT '[]'::jsonb, reply_classification TEXT NOT NULL DEFAULT '', reply_summary TEXT NOT NULL DEFAULT '', reply_draft TEXT NOT NULL DEFAULT '', stop_contact BOOLEAN NOT NULL DEFAULT FALSE,
 evidence JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(platform,profile_url)
)`);await pool.query("ALTER TABLE creator_hunt_leads ADD COLUMN IF NOT EXISTS creator_tier TEXT NOT NULL DEFAULT 'emerging'");await pool.query("ALTER TABLE creator_hunt_leads ADD COLUMN IF NOT EXISTS growth_score INTEGER NOT NULL DEFAULT 0");await pool.query("ALTER TABLE creator_hunt_leads ADD COLUMN IF NOT EXISTS monetization_score INTEGER NOT NULL DEFAULT 0");await pool.query("ALTER TABLE creator_hunt_leads ADD COLUMN IF NOT EXISTS brand_readiness_score INTEGER NOT NULL DEFAULT 0");await pool.query("ALTER TABLE creator_hunt_leads ADD COLUMN IF NOT EXISTS ai_discoverability_score INTEGER NOT NULL DEFAULT 0");await pool.query("ALTER TABLE creator_hunt_leads ADD COLUMN IF NOT EXISTS cross_platform_score INTEGER NOT NULL DEFAULT 0");await pool.query("ALTER TABLE creator_hunt_leads ADD COLUMN IF NOT EXISTS qualification_level TEXT NOT NULL DEFAULT 'cold'");await pool.query("ALTER TABLE creator_hunt_leads ADD COLUMN IF NOT EXISTS forecast_probability INTEGER NOT NULL DEFAULT 0");await pool.query("ALTER TABLE creator_hunt_leads ADD COLUMN IF NOT EXISTS next_best_action TEXT NOT NULL DEFAULT ''");await pool.query("ALTER TABLE creator_hunt_leads ADD COLUMN IF NOT EXISTS next_action_priority INTEGER NOT NULL DEFAULT 0");await pool.query("ALTER TABLE creator_hunt_leads ADD COLUMN IF NOT EXISTS truth_status TEXT NOT NULL DEFAULT 'review'");await pool.query("ALTER TABLE creator_hunt_leads ADD COLUMN IF NOT EXISTS baseline_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb");await pool.query("ALTER TABLE creator_hunt_leads ADD COLUMN IF NOT EXISTS latest_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb");await pool.query("ALTER TABLE creator_hunt_leads ADD COLUMN IF NOT EXISTS last_measured_at TIMESTAMPTZ");await pool.query("ALTER TABLE creator_hunt_leads ADD COLUMN IF NOT EXISTS crm_stage TEXT NOT NULL DEFAULT 'new'");await pool.query("ALTER TABLE creator_hunt_leads ADD COLUMN IF NOT EXISTS proposal_status TEXT NOT NULL DEFAULT 'none'");await pool.query("ALTER TABLE creator_hunt_leads ADD COLUMN IF NOT EXISTS proposal_scope JSONB NOT NULL DEFAULT '{}'::jsonb");await pool.query("ALTER TABLE creator_hunt_leads ADD COLUMN IF NOT EXISTS next_follow_up DATE");await pool.query("ALTER TABLE creator_hunt_leads ADD COLUMN IF NOT EXISTS crm_notes TEXT NOT NULL DEFAULT ''");await pool.query("ALTER TABLE creator_hunt_leads ADD COLUMN IF NOT EXISTS outreach_reason TEXT NOT NULL DEFAULT ''");await pool.query("ALTER TABLE creator_hunt_leads ADD COLUMN IF NOT EXISTS outreach_subject TEXT NOT NULL DEFAULT ''");await pool.query("ALTER TABLE creator_hunt_leads ADD COLUMN IF NOT EXISTS outreach_draft TEXT NOT NULL DEFAULT ''");await pool.query("ALTER TABLE creator_hunt_leads ADD COLUMN IF NOT EXISTS audit_focus JSONB NOT NULL DEFAULT '[]'::jsonb");await pool.query("ALTER TABLE creator_hunt_leads ADD COLUMN IF NOT EXISTS reply_classification TEXT NOT NULL DEFAULT ''");await pool.query("ALTER TABLE creator_hunt_leads ADD COLUMN IF NOT EXISTS reply_summary TEXT NOT NULL DEFAULT ''");await pool.query("ALTER TABLE creator_hunt_leads ADD COLUMN IF NOT EXISTS reply_draft TEXT NOT NULL DEFAULT ''");await pool.query("ALTER TABLE creator_hunt_leads ADD COLUMN IF NOT EXISTS stop_contact BOOLEAN NOT NULL DEFAULT FALSE");return await fn(pool)}finally{await pool.end()}}
const clean=(v,n=500)=>String(v||"").trim().slice(0,n);
export async function saveCreatorHuntLeads(items=[]){
 return await withDb(async pool=>{const out=[];for(const x of items){
  const platform=clean(x.platform,40).toLowerCase(),profileUrl=clean(x.profileUrl,700),displayName=clean(x.displayName,180);
  if(!platform||!profileUrl||!displayName)continue;
  const score=Math.max(0,Math.min(100,Number(x.opportunityScore)||0));
  const row=(await pool.query(`INSERT INTO creator_hunt_leads(id,platform,handle,display_name,profile_url,niche,country,language,public_contact,source_url,opportunity_score,evidence)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
   ON CONFLICT(platform,profile_url) DO UPDATE SET handle=EXCLUDED.handle,display_name=EXCLUDED.display_name,niche=EXCLUDED.niche,country=EXCLUDED.country,language=EXCLUDED.language,public_contact=EXCLUDED.public_contact,source_url=EXCLUDED.source_url,opportunity_score=GREATEST(creator_hunt_leads.opportunity_score,EXCLUDED.opportunity_score),evidence=EXCLUDED.evidence,updated_at=NOW()
   RETURNING id,platform,handle,display_name AS "displayName",profile_url AS "profileUrl",niche,country,language,public_contact AS "publicContact",source_url AS "sourceUrl",opportunity_score AS "opportunityScore",status,created_at AS "createdAt",updated_at AS "updatedAt"`,
   [crypto.randomUUID(),platform,clean(x.handle,180),displayName,profileUrl,clean(x.niche,180),clean(x.country,120),clean(x.language,30),clean(x.publicContact,240),clean(x.sourceUrl,700),score,JSON.stringify(x.evidence||{})])).rows[0];out.push(row)}return out})
}
export async function listCreatorHuntLeads(limit=150){
 const safe=Math.max(1,Math.min(Number(limit)||150,300));
 return await withDb(async pool=>(await pool.query('SELECT id,platform,handle,display_name AS "displayName",profile_url AS "profileUrl",niche,country,language,public_contact AS "publicContact",source_url AS "sourceUrl",opportunity_score AS "opportunityScore",status,created_at AS "createdAt",updated_at AS "updatedAt" FROM creator_hunt_leads ORDER BY opportunity_score DESC,updated_at DESC LIMIT $1',[safe])).rows)
}


export async function creatorMarketSnapshot(){
 return await withDb(async pool=>{
  const byPlatform=(await pool.query(`SELECT platform,COUNT(*)::int AS leads,ROUND(AVG(opportunity_score))::int AS opportunity,ROUND(AVG(growth_score))::int AS growth,ROUND(AVG(monetization_score))::int AS monetization,ROUND(AVG(brand_readiness_score))::int AS "brandReadiness" FROM creator_hunt_leads GROUP BY platform ORDER BY leads DESC`)).rows;
  const byNiche=(await pool.query(`SELECT niche,COUNT(*)::int AS leads,ROUND(AVG(opportunity_score))::int AS opportunity FROM creator_hunt_leads WHERE niche<>'' GROUP BY niche ORDER BY opportunity DESC,leads DESC LIMIT 30`)).rows;
  return {byPlatform,byNiche};
 })||{byPlatform:[],byNiche:[]};
}


export async function refreshCreatorIntelligence(){
 return await withDb(async pool=>{
  const rows=(await pool.query(`SELECT * FROM creator_hunt_leads ORDER BY updated_at DESC LIMIT 1000`)).rows,out=[];
  for(const x of rows){
   const hasSource=Boolean(x.source_url&&/^https?:\/\//i.test(x.source_url)),hasProfile=Boolean(x.profile_url&&/^https?:\/\//i.test(x.profile_url));
   const truthStatus=hasSource&&hasProfile?"verified":"review",opportunity=Math.max(0,Math.min(100,Number(x.opportunity_score)||0)),contact=Boolean(x.public_contact);
   const qualification=opportunity>=75&&truthStatus==="verified"?"hot":opportunity>=55&&truthStatus==="verified"?"warm":opportunity>=35?"cool":"cold";
   const probability=Math.max(5,Math.min(90,Math.round(opportunity*.55+(contact?12:0)+(truthStatus==="verified"?13:0))));
   let action="collect-more-evidence",priority=40;
   if(truthStatus!=="verified"){action="verify-public-evidence";priority=85}else if(opportunity>=70&&!contact){action="find-public-business-contact";priority=80}else if(opportunity>=70&&contact){action="prepare-personalized-creator-audit";priority=90}else if(opportunity>=50){action="deep-creator-diagnosis";priority=70}
   await pool.query(`UPDATE creator_hunt_leads SET qualification_level=$2,forecast_probability=$3,next_best_action=$4,next_action_priority=$5,truth_status=$6,updated_at=NOW() WHERE id=$1`,[x.id,qualification,probability,action,priority,truthStatus]);
   out.push({id:x.id,displayName:x.display_name,platform:x.platform,qualification,probability,action,priority,truthStatus});
  }return out.sort((a,b)=>b.priority-a.priority||b.probability-a.probability);
 })||[];
}


export async function creatorLearningSnapshot(){
 return await withDb(async pool=>{
  const platforms=(await pool.query(`SELECT platform,COUNT(*)::int AS leads,COUNT(*) FILTER(WHERE qualification_level IN ('warm','hot'))::int AS qualified,ROUND(AVG(opportunity_score))::int AS opportunity,ROUND(AVG(forecast_probability))::int AS forecast FROM creator_hunt_leads GROUP BY platform ORDER BY qualified DESC,opportunity DESC`)).rows;
  const niches=(await pool.query(`SELECT niche,COUNT(*)::int AS leads,COUNT(*) FILTER(WHERE qualification_level IN ('warm','hot'))::int AS qualified,ROUND(AVG(opportunity_score))::int AS opportunity FROM creator_hunt_leads WHERE niche<>'' GROUP BY niche ORDER BY qualified DESC,opportunity DESC LIMIT 40`)).rows;
  const countries=(await pool.query(`SELECT country,COUNT(*)::int AS leads,COUNT(*) FILTER(WHERE qualification_level IN ('warm','hot'))::int AS qualified,ROUND(AVG(opportunity_score))::int AS opportunity FROM creator_hunt_leads WHERE country<>'' GROUP BY country ORDER BY qualified DESC,opportunity DESC LIMIT 40`)).rows;
  const score=x=>{const n=Number(x.leads||0),q=Number(x.qualified||0),o=Number(x.opportunity||0);return Math.min(100,Math.round((n?100*q/n:0)*.55+o*.45))};
  return {platforms:platforms.map(x=>({...x,learningScore:score(x)})),niches:niches.map(x=>({...x,learningScore:score(x)})),countries:countries.map(x=>({...x,learningScore:score(x)}))};
 })||{platforms:[],niches:[],countries:[]};
}
export async function creatorPredictiveAlerts(){
 const s=await creatorLearningSnapshot(),alerts=[];
 const inspect=(kind,rows)=>{for(const x of rows){if(Number(x.leads)>=5&&Number(x.learningScore)<25)alerts.push({kind,key:x[kind]||x.platform||x.niche||x.country,severity:"warning",reason:"Yeterli örnek oluşmasına rağmen nitelikli Creator oranı ve fırsat kalitesi düşük.",score:Number(x.learningScore)});if(Number(x.qualified)>=3&&Number(x.learningScore)>=65)alerts.push({kind,key:x[kind]||x.platform||x.niche||x.country,severity:"opportunity",reason:"Nitelikli Creator yoğunluğu yüksek; daha derin tarama için aday.",score:Number(x.learningScore)})}};
 inspect("platform",s.platforms);inspect("niche",s.niches);inspect("country",s.countries);return alerts.sort((a,b)=>b.score-a.score);
}


export async function refreshCreatorRemeasurement(){
 return await withDb(async pool=>{
  const rows=(await pool.query(`SELECT id,display_name,platform,opportunity_score,growth_score,monetization_score,brand_readiness_score,ai_discoverability_score,cross_platform_score,baseline_snapshot,latest_snapshot,last_measured_at FROM creator_hunt_leads WHERE truth_status='verified' ORDER BY updated_at DESC LIMIT 500`)).rows,out=[];
  for(const x of rows){
   const current={opportunity:Number(x.opportunity_score||0),growth:Number(x.growth_score||0),monetization:Number(x.monetization_score||0),brandReadiness:Number(x.brand_readiness_score||0),aiDiscoverability:Number(x.ai_discoverability_score||0),crossPlatform:Number(x.cross_platform_score||0)};
   const baseline=x.baseline_snapshot&&Object.keys(x.baseline_snapshot).length?x.baseline_snapshot:current;
   const deltas={};for(const k of Object.keys(current))deltas[k]=Number(current[k]||0)-Number(baseline[k]||0);
   await pool.query(`UPDATE creator_hunt_leads SET baseline_snapshot=CASE WHEN baseline_snapshot='{}'::jsonb THEN $2::jsonb ELSE baseline_snapshot END,latest_snapshot=$3::jsonb,last_measured_at=NOW() WHERE id=$1`,[x.id,JSON.stringify(current),JSON.stringify(current)]);
   out.push({id:x.id,displayName:x.display_name,platform:x.platform,baseline,current,deltas,note:"Skor değişimi korelasyondur; belirli bir uygulamanın nedensel etkisini tek başına kanıtlamaz."});
  }return out;
 })||[];
}


export async function creatorCommercialFunnelSnapshot(){
 return await withDb(async pool=>{
  const totals=(await pool.query(`SELECT COUNT(*)::int AS found,
   COUNT(*) FILTER(WHERE truth_status='verified')::int AS verified,
   COUNT(*) FILTER(WHERE qualification_level IN ('warm','hot'))::int AS qualified,
   COUNT(*) FILTER(WHERE public_contact<>'')::int AS contactable,
   COUNT(*) FILTER(WHERE next_best_action='prepare-personalized-creator-audit')::int AS offer_ready,
   COUNT(*) FILTER(WHERE last_measured_at IS NOT NULL)::int AS remeasured
   FROM creator_hunt_leads`)).rows[0]||{};
  const byPlatform=(await pool.query(`SELECT platform,COUNT(*)::int AS found,
   COUNT(*) FILTER(WHERE qualification_level IN ('warm','hot'))::int AS qualified,
   COUNT(*) FILTER(WHERE public_contact<>'')::int AS contactable,
   COUNT(*) FILTER(WHERE next_best_action='prepare-personalized-creator-audit')::int AS offer_ready,
   ROUND(AVG(forecast_probability))::int AS forecast
   FROM creator_hunt_leads GROUP BY platform ORDER BY qualified DESC,found DESC`)).rows;
  const f={};for(const [k,v] of Object.entries(totals))f[k]=Number(v||0);
  const rate=(a,b)=>b?Math.round(a/b*100):0;
  return {funnel:f,rates:{verification:rate(f.verified,f.found),qualification:rate(f.qualified,f.verified),contactability:rate(f.contactable,f.qualified),offerReadiness:rate(f.offer_ready,f.contactable),remeasurement:rate(f.remeasured,f.verified)},byPlatform,note:"Creator geliri/ödeme dönüşümü henüz ayrı doğrulanmış ticari kayıtla bağlanmadığı için uydurulmaz ve bu raporda gösterilmez."};
 })||{funnel:{},rates:{},byPlatform:[]};
}


export async function refreshCreatorCRMBridge(){
 return await withDb(async pool=>{
  const rows=(await pool.query(`SELECT * FROM creator_hunt_leads WHERE truth_status='verified' ORDER BY next_action_priority DESC,opportunity_score DESC LIMIT 500`)).rows,out=[];
  for(const x of rows){
   let stage=x.crm_stage||"new",proposalStatus=x.proposal_status||"none",scope=x.proposal_scope||{};
   if(stage==="new"&&["warm","hot"].includes(x.qualification_level))stage="qualified";
   if(["new","qualified"].includes(stage)&&x.public_contact)stage="contact-ready";
   if(["warm","hot"].includes(x.qualification_level)&&x.public_contact&&Number(x.opportunity_score)>=70&&proposalStatus==="none"){
    proposalStatus="draft";
    scope={type:"creator-growth-audit",platform:x.platform,niche:x.niche,country:x.country,focus:["discoverability","content-system","ai-authority","monetization-readiness","cross-platform-opportunity"],pricing:"not-set",requiresHumanApproval:true};
   }
   await pool.query(`UPDATE creator_hunt_leads SET crm_stage=$2,proposal_status=$3,proposal_scope=$4::jsonb,updated_at=NOW() WHERE id=$1`,[x.id,stage,proposalStatus,JSON.stringify(scope)]);
   out.push({id:x.id,displayName:x.display_name,platform:x.platform,stage,proposalStatus,scope});
  }return out;
 })||[];
}
export async function listCreatorCRM(limit=200){
 const safe=Math.max(1,Math.min(Number(limit)||200,500));
 return await withDb(async pool=>(await pool.query(`SELECT id,display_name AS "displayName",platform,handle,profile_url AS "profileUrl",niche,country,public_contact AS "publicContact",opportunity_score AS "opportunityScore",qualification_level AS "qualificationLevel",forecast_probability AS "forecastProbability",crm_stage AS "stage",proposal_status AS "proposalStatus",proposal_scope AS "proposalScope",next_follow_up AS "nextFollowUp",crm_notes AS notes,updated_at AS "updatedAt" FROM creator_hunt_leads ORDER BY next_action_priority DESC,opportunity_score DESC LIMIT $1`,[safe])).rows)||[];
}
export async function updateCreatorCRM(id,{stage,nextFollowUp,notes}={}){
 const allowed=["new","qualified","contact-ready","contacted","reply","warm","proposal","payment","won","lost"];
 if(stage&&!allowed.includes(stage))throw new Error("invalid-creator-crm-stage");
 return await withDb(async pool=>(await pool.query(`UPDATE creator_hunt_leads SET crm_stage=COALESCE($2,crm_stage),next_follow_up=$3,crm_notes=COALESCE($4,crm_notes),updated_at=NOW() WHERE id=$1 RETURNING id,display_name AS "displayName",platform,crm_stage AS stage,proposal_status AS "proposalStatus",next_follow_up AS "nextFollowUp",crm_notes AS notes`,[id,stage||null,nextFollowUp||null,notes==null?null:String(notes).slice(0,2000)])).rows[0])||null;
}


export async function refreshCreatorOutreachDrafts(limit=30){
 return await withDb(async pool=>{
  const safe=Math.max(1,Math.min(Number(limit)||30,60));
  const rows=(await pool.query(`SELECT * FROM creator_hunt_leads WHERE truth_status='verified' AND crm_stage='contact-ready' AND public_contact<>'' AND proposal_status='draft' AND outreach_draft='' ORDER BY opportunity_score DESC LIMIT $1`,[safe])).rows,out=[];
  for(const x of rows){
   try{
    const draft=await personalizeCreatorOutreach({displayName:x.display_name,platform:x.platform,handle:x.handle,profileUrl:x.profile_url,niche:x.niche,country:x.country,opportunityScore:x.opportunity_score,evidence:x.evidence,publicContact:x.public_contact,proposalScope:x.proposal_scope});
    if(!draft.draft||!draft.reason)continue;
    await pool.query(`UPDATE creator_hunt_leads SET outreach_reason=$2,outreach_subject=$3,outreach_draft=$4,audit_focus=$5::jsonb,updated_at=NOW() WHERE id=$1`,[x.id,draft.reason,draft.subject,draft.draft,JSON.stringify(draft.auditFocus||[])]);
    out.push({id:x.id,displayName:x.display_name,platform:x.platform,...draft});
   }catch(e){out.push({id:x.id,displayName:x.display_name,platform:x.platform,status:"error",error:String(e?.message||e).slice(0,180)})}
  }return out;
 })||[];
}


export async function analyzeAndSaveCreatorReply(id,replyText){
 const creator=await withDb(async pool=>(await pool.query(`SELECT id,display_name AS "displayName",platform,country,proposal_scope AS "proposalScope" FROM creator_hunt_leads WHERE id=$1`,[id])).rows[0]);
 if(!creator)throw new Error("creator-not-found");
 const analysis=await analyzeCreatorReply({...creator,replyText:String(replyText||"").slice(0,6000)});
 const saved=await withDb(async pool=>(await pool.query(`UPDATE creator_hunt_leads SET reply_classification=$2,reply_summary=$3,reply_draft=$4,stop_contact=$5,crm_stage=$6,next_follow_up=CASE WHEN $5 THEN NULL ELSE next_follow_up END,updated_at=NOW() WHERE id=$1 RETURNING id,display_name AS "displayName",crm_stage AS stage,reply_classification AS classification,reply_summary AS summary,reply_draft AS "draftReply",stop_contact AS "stopContact"`,[id,analysis.classification,analysis.summary,analysis.draftReply,analysis.stopContact,analysis.crmStage])).rows[0]);
 return {analysis,saved};
}
