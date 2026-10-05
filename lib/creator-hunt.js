import crypto from "node:crypto";
import {getDatabaseUrl} from "./db";

function dbUrl(){return getDatabaseUrl()||""}
async function withDb(fn){const url=dbUrl();if(!url)throw new Error("database-not-configured");const {Pool}=await import("pg");const pool=new Pool({connectionString:url});try{await pool.query(`CREATE TABLE IF NOT EXISTS creator_hunt_leads(
 id UUID PRIMARY KEY, platform TEXT NOT NULL, handle TEXT NOT NULL DEFAULT '', display_name TEXT NOT NULL,
 profile_url TEXT NOT NULL DEFAULT '', niche TEXT NOT NULL DEFAULT '', country TEXT NOT NULL DEFAULT '',
 language TEXT NOT NULL DEFAULT '', public_contact TEXT NOT NULL DEFAULT '', source_url TEXT NOT NULL DEFAULT '',
 opportunity_score INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'new',
 creator_tier TEXT NOT NULL DEFAULT 'emerging', growth_score INTEGER NOT NULL DEFAULT 0, monetization_score INTEGER NOT NULL DEFAULT 0, brand_readiness_score INTEGER NOT NULL DEFAULT 0, ai_discoverability_score INTEGER NOT NULL DEFAULT 0, cross_platform_score INTEGER NOT NULL DEFAULT 0, qualification_level TEXT NOT NULL DEFAULT 'cold', forecast_probability INTEGER NOT NULL DEFAULT 0, next_best_action TEXT NOT NULL DEFAULT '', next_action_priority INTEGER NOT NULL DEFAULT 0, truth_status TEXT NOT NULL DEFAULT 'review', baseline_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb, latest_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb, last_measured_at TIMESTAMPTZ,
 evidence JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(platform,profile_url)
)`);await pool.query("ALTER TABLE creator_hunt_leads ADD COLUMN IF NOT EXISTS creator_tier TEXT NOT NULL DEFAULT 'emerging'");await pool.query("ALTER TABLE creator_hunt_leads ADD COLUMN IF NOT EXISTS growth_score INTEGER NOT NULL DEFAULT 0");await pool.query("ALTER TABLE creator_hunt_leads ADD COLUMN IF NOT EXISTS monetization_score INTEGER NOT NULL DEFAULT 0");await pool.query("ALTER TABLE creator_hunt_leads ADD COLUMN IF NOT EXISTS brand_readiness_score INTEGER NOT NULL DEFAULT 0");await pool.query("ALTER TABLE creator_hunt_leads ADD COLUMN IF NOT EXISTS ai_discoverability_score INTEGER NOT NULL DEFAULT 0");await pool.query("ALTER TABLE creator_hunt_leads ADD COLUMN IF NOT EXISTS cross_platform_score INTEGER NOT NULL DEFAULT 0");await pool.query("ALTER TABLE creator_hunt_leads ADD COLUMN IF NOT EXISTS qualification_level TEXT NOT NULL DEFAULT 'cold'");await pool.query("ALTER TABLE creator_hunt_leads ADD COLUMN IF NOT EXISTS forecast_probability INTEGER NOT NULL DEFAULT 0");await pool.query("ALTER TABLE creator_hunt_leads ADD COLUMN IF NOT EXISTS next_best_action TEXT NOT NULL DEFAULT ''");await pool.query("ALTER TABLE creator_hunt_leads ADD COLUMN IF NOT EXISTS next_action_priority INTEGER NOT NULL DEFAULT 0");await pool.query("ALTER TABLE creator_hunt_leads ADD COLUMN IF NOT EXISTS truth_status TEXT NOT NULL DEFAULT 'review'");await pool.query("ALTER TABLE creator_hunt_leads ADD COLUMN IF NOT EXISTS baseline_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb");await pool.query("ALTER TABLE creator_hunt_leads ADD COLUMN IF NOT EXISTS latest_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb");await pool.query("ALTER TABLE creator_hunt_leads ADD COLUMN IF NOT EXISTS last_measured_at TIMESTAMPTZ");return await fn(pool)}finally{await pool.end()}}
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
