import crypto from "node:crypto";
import {getDatabaseUrl} from "./db";

function normalizeDatabaseUrl(rawUrl){
  if(!rawUrl)return "";
  try{const url=new URL(rawUrl);const sslmode=url.searchParams.get("sslmode");if(["prefer","require","verify-ca"].includes(sslmode))url.searchParams.set("sslmode","verify-full");return url.toString()}catch{return rawUrl}
}

async function withDb(fn){
  const url=normalizeDatabaseUrl(getDatabaseUrl());
  if(!url)throw new Error("database-not-configured");
  const {Pool}=await import("pg");
  const pool=new Pool({connectionString:url});
  try{await ensure(pool);return await fn(pool)}finally{await pool.end()}
}

async function ensure(pool){
  await pool.query(`CREATE TABLE IF NOT EXISTS creator_profiles(
    id UUID PRIMARY KEY,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    display_name TEXT NOT NULL,
    niche TEXT NOT NULL DEFAULT '',
    country TEXT NOT NULL DEFAULT '',
    language TEXT NOT NULL DEFAULT 'tr',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS creator_accounts(
    id UUID PRIMARY KEY,
    profile_id UUID NOT NULL REFERENCES creator_profiles(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    handle TEXT NOT NULL DEFAULT '',
    profile_url TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'connected-manual',
    metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(profile_id,platform)
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS creator_findings(
    id UUID PRIMARY KEY,
    profile_id UUID NOT NULL REFERENCES creator_profiles(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    category TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium',
    title TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    source_agent TEXT NOT NULL DEFAULT 'Visibility Diagnostician',
    status TEXT NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS creator_tasks(
    id UUID PRIMARY KEY,
    profile_id UUID NOT NULL REFERENCES creator_profiles(id) ON DELETE CASCADE,
    finding_id UUID REFERENCES creator_findings(id) ON DELETE SET NULL,
    platform TEXT NOT NULL,
    desk TEXT NOT NULL DEFAULT 'solution',
    agent_name TEXT NOT NULL,
    title TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    priority TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'ready',
    requires_approval BOOLEAN NOT NULL DEFAULT false,
    requires_access BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
}

const clean=v=>String(v||"").trim();
const allowedPlatforms=new Set(["youtube","instagram","tiktok","x","linkedin","facebook","other"]);
const allowedSeverity=new Set(["low","medium","high","critical"]);
const allowedTaskStatus=new Set(["ready","approval-required","access-required","in-progress","completed"]);

export async function listCreatorWorkspace(){
  return await withDb(async pool=>{
    const [profiles,accounts,findings,tasks]=await Promise.all([
      pool.query('SELECT id,client_id AS "clientId",display_name AS "displayName",niche,country,language,status,created_at AS "createdAt",updated_at AS "updatedAt" FROM creator_profiles ORDER BY created_at DESC'),
      pool.query('SELECT id,profile_id AS "profileId",platform,handle,profile_url AS "profileUrl",status,metrics,updated_at AS "updatedAt" FROM creator_accounts ORDER BY updated_at DESC'),
      pool.query('SELECT id,profile_id AS "profileId",platform,category,severity,title,detail,source_agent AS "sourceAgent",status,created_at AS "createdAt" FROM creator_findings ORDER BY created_at DESC LIMIT 200'),
      pool.query('SELECT id,profile_id AS "profileId",finding_id AS "findingId",platform,desk,agent_name AS "agentName",title,detail,priority,status,requires_approval AS "requiresApproval",requires_access AS "requiresAccess",created_at AS "createdAt",updated_at AS "updatedAt" FROM creator_tasks ORDER BY updated_at DESC LIMIT 300')
    ]);
    return {profiles:profiles.rows,accounts:accounts.rows,findings:findings.rows,tasks:tasks.rows};
  });
}

export async function addCreatorProfile(input={}){
  const displayName=clean(input.displayName);if(!displayName)throw new Error("display-name-required");
  const id=crypto.randomUUID();
  return await withDb(async pool=>(await pool.query(
    'INSERT INTO creator_profiles(id,client_id,display_name,niche,country,language) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,client_id AS "clientId",display_name AS "displayName",niche,country,language,status,created_at AS "createdAt"',
    [id,input.clientId||null,displayName,clean(input.niche),clean(input.country),clean(input.language)||"tr"]
  )).rows[0]);
}

export async function upsertCreatorAccount(input={}){
  const platform=clean(input.platform).toLowerCase();if(!allowedPlatforms.has(platform))throw new Error("invalid-platform");
  return await withDb(async pool=>(await pool.query(
    `INSERT INTO creator_accounts(id,profile_id,platform,handle,profile_url,metrics)
     VALUES($1,$2,$3,$4,$5,$6::jsonb)
     ON CONFLICT(profile_id,platform) DO UPDATE SET handle=EXCLUDED.handle,profile_url=EXCLUDED.profile_url,metrics=EXCLUDED.metrics,updated_at=NOW()
     RETURNING id,profile_id AS "profileId",platform,handle,profile_url AS "profileUrl",status,metrics,updated_at AS "updatedAt"`,
    [crypto.randomUUID(),input.profileId,platform,clean(input.handle),clean(input.profileUrl),JSON.stringify(input.metrics||{})]
  )).rows[0]);
}

export async function addCreatorFinding(input={}){
  const platform=clean(input.platform).toLowerCase();if(!allowedPlatforms.has(platform))throw new Error("invalid-platform");
  const severity=allowedSeverity.has(input.severity)?input.severity:"medium";
  const title=clean(input.title);if(!title)throw new Error("finding-title-required");
  return await withDb(async pool=>(await pool.query(
    'INSERT INTO creator_findings(id,profile_id,platform,category,severity,title,detail,source_agent) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,profile_id AS "profileId",platform,category,severity,title,detail,source_agent AS "sourceAgent",status,created_at AS "createdAt"',
    [crypto.randomUUID(),input.profileId,platform,clean(input.category)||"visibility",severity,title,clean(input.detail),clean(input.sourceAgent)||"Visibility Diagnostician"]
  )).rows[0]);
}

function solutionFor(f){
  const c=String(f.category||"").toLowerCase();
  if(c.includes("retention")||c.includes("hook"))return {agent:"Hook & Retention Agent",title:`${f.platform}: izlenme tutma planı`,detail:`${f.title} bulgusuna göre hook, giriş ve içerik akışını yeniden tasarla.`};
  if(c.includes("profile")||c.includes("bio"))return {agent:"Profile Optimizer",title:`${f.platform}: profil optimizasyonu`,detail:`${f.title} bulgusuna göre bio, profil alanları ve CTA yapısını iyileştir.`};
  if(c.includes("money")||c.includes("monet")||c.includes("revenue"))return {agent:"Monetization Agent",title:`${f.platform}: gelir modeli iyileştirmesi`,detail:`${f.title} bulgusuna göre sponsor, affiliate ve ürün/hizmet gelir yollarını hazırla.`};
  if(c.includes("seo")||c.includes("discover")||c.includes("visibility"))return {agent:"SEO & Discovery Agent",title:`${f.platform}: keşfedilebilirlik optimizasyonu`,detail:`${f.title} bulgusuna göre anahtar kelime, başlık, açıklama ve platform içi keşif planı üret.`};
  return {agent:"Content Strategist",title:`${f.platform}: içerik çözüm planı`,detail:`${f.title} bulgusunu içerik planı, seri ve yayın görevlerine dönüştür.`};
}

export async function generateCreatorSolutionTasks(profileId){
  return await withDb(async pool=>{
    const findings=(await pool.query("SELECT id,profile_id,platform,category,severity,title,detail FROM creator_findings WHERE profile_id=$1 AND status='open' ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,created_at DESC",[profileId])).rows;
    const rows=[];
    for(const f of findings){
      const exists=(await pool.query('SELECT id FROM creator_tasks WHERE finding_id=$1 LIMIT 1',[f.id])).rows[0];if(exists)continue;
      const s=solutionFor(f);const priority=["critical","high"].includes(f.severity)?"high":f.severity==="low"?"low":"medium";
      const requiresApproval=["profile","bio","monetization"].some(x=>String(f.category).toLowerCase().includes(x));
      const status=requiresApproval?"approval-required":"ready";
      const row=(await pool.query(
        'INSERT INTO creator_tasks(id,profile_id,finding_id,platform,desk,agent_name,title,detail,priority,status,requires_approval) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id,profile_id AS "profileId",finding_id AS "findingId",platform,desk,agent_name AS "agentName",title,detail,priority,status,requires_approval AS "requiresApproval",requires_access AS "requiresAccess",created_at AS "createdAt"',
        [crypto.randomUUID(),profileId,f.id,f.platform,"solution",s.agent,s.title,s.detail,priority,status,requiresApproval]
      )).rows[0];rows.push(row);
    }
    return rows;
  });
}

export async function updateCreatorTask(id,status){
  if(!allowedTaskStatus.has(status))throw new Error("invalid-task-status");
  return await withDb(async pool=>(await pool.query('UPDATE creator_tasks SET status=$2,updated_at=NOW() WHERE id=$1 RETURNING id,profile_id AS "profileId",platform,agent_name AS "agentName",title,priority,status,updated_at AS "updatedAt"',[id,status])).rows[0]||null);
}
