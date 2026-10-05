import {getDatabaseUrl} from "./db";

function normalizeDatabaseUrl(rawUrl){
  if(!rawUrl)return "";
  try{
    const url=new URL(rawUrl);
    const sslmode=url.searchParams.get("sslmode");
    if(["prefer","require","verify-ca"].includes(sslmode))url.searchParams.set("sslmode","verify-full");
    return url.toString();
  }catch{return rawUrl}
}

async function db(fn){
  const url=normalizeDatabaseUrl(getDatabaseUrl()); if(!url) return null;
  const {Pool}=await import("pg");
  const p=new Pool({connectionString:url});
  try{
    await p.query(`CREATE TABLE IF NOT EXISTS prospects(
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      domain TEXT NOT NULL DEFAULT '',
      sector TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT 'Türkiye',
      source TEXT NOT NULL DEFAULT 'manual',
      status TEXT NOT NULL DEFAULT 'new',
      score INTEGER,
      reason TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'Türkiye'");
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS qualification_score INTEGER");
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS qualification_level TEXT NOT NULL DEFAULT ''");
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS qualification_reason TEXT NOT NULL DEFAULT ''");
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS contact_email TEXT NOT NULL DEFAULT ''");
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS contact_url TEXT NOT NULL DEFAULT ''");
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS contact_source_url TEXT NOT NULL DEFAULT ''");
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS contact_status TEXT NOT NULL DEFAULT ''");
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS outreach_reason TEXT NOT NULL DEFAULT ''");
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS outreach_draft TEXT NOT NULL DEFAULT ''");
    await p.query("ALTER TABLE prospects ADD COLUMN IF NOT EXISTS outreach_status TEXT NOT NULL DEFAULT ''");
    await p.query(`CREATE TABLE IF NOT EXISTS visibility_scans(
      id UUID PRIMARY KEY,
      prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'queued',
      score INTEGER,
      summary TEXT NOT NULL DEFAULT '',
      findings JSONB NOT NULL DEFAULT '[]'::jsonb,
      recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
      provider TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    )`);
    return await fn(p)
  }finally{await p.end()}
}

export async function listProspects(){
  return await db(async p=>(await p.query(`SELECT p.id,p.name,p.domain,p.sector,p.city,p.country,p.source,p.status,p.score,p.reason,p.created_at AS "createdAt",
    (SELECT vs.status FROM visibility_scans vs WHERE vs.prospect_id=p.id ORDER BY vs.created_at DESC LIMIT 1) AS "scanStatus"
    FROM prospects p ORDER BY p.created_at DESC`)).rows)||[]
}

export async function addProspect(x){
  const id=crypto.randomUUID();
  const r=await db(async p=>(await p.query(
    'INSERT INTO prospects(id,name,domain,sector,city,country,source) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,name,domain,sector,city,country,source,status,score,reason,created_at AS "createdAt"',
    [id,x.name,x.domain,x.sector,x.city,x.country||"Türkiye",x.source]
  )).rows[0]);
  return r||{id,...x,status:"demo-only"}
}

export async function seedProspects(items=[]){
  const out=[];
  for(const x of items){
    const existing=await db(async p=>(await p.query(
      'SELECT id,name,domain,sector,city,country,source,status,score,reason,created_at AS "createdAt" FROM prospects WHERE lower(name)=lower($1) LIMIT 1',[x.name]
    )).rows[0]);
    if(existing){out.push(existing);continue}
    out.push(await addProspect(x))
  }
  return out
}

const HIGH_VALUE_MARKETS=new Set(["united states","united kingdom","germany","france","netherlands","canada","united arab emirates","saudi arabia","singapore","australia","japan","austria","switzerland","hong kong"]);
const STRONG_FIT=["sağlık","klinik","diş","otel","turizm","emlak","gayrimenkul","otomotiv","güzellik","e-ticaret","hukuk","eğitim","yazılım","teknoloji","fitness","restoran"];
export async function qualifyProspect(prospectId){
  return await db(async p=>{
    const x=(await p.query("SELECT * FROM prospects WHERE id=$1",[prospectId])).rows[0];if(!x)return null;
    let score=10,reasons=[];const country=String(x.country||"").toLowerCase(),sector=String(x.sector||"").toLowerCase();
    if(x.domain){score+=25;reasons.push("doğrulanabilir web/domain")}
    if(x.source){score+=10;reasons.push("kamusal keşif kaynağı")}
    if(HIGH_VALUE_MARKETS.has(country)){score+=20;reasons.push("yüksek ticari değerli pazar")}else if(country==="türkiye"||country==="turkey"){score+=15;reasons.push("öncelikli Türkiye pazarı")}
    if(STRONG_FIT.some(s=>sector.includes(s))){score+=20;reasons.push("çözüm satılabilirliği güçlü sektör")}
    score=Math.max(0,Math.min(100,score));const level=score>=70?"hot":score>=45?"warm":"low";
    return (await p.query("UPDATE prospects SET qualification_score=$2,qualification_level=$3,qualification_reason=$4 WHERE id=$1 RETURNING id,name,qualification_score AS \"qualificationScore\",qualification_level AS \"qualificationLevel\",qualification_reason AS \"qualificationReason\"",[prospectId,score,level,reasons.join(" · ")||"sınırlı doğrulanabilir satış sinyali"])).rows[0]
  })
}

export async function queueProspectScan(prospectId){
  const id=crypto.randomUUID();
  const row=await db(async p=>{
    const exists=(await p.query('SELECT id FROM prospects WHERE id=$1',[prospectId])).rows[0];
    if(!exists){const e=new Error("prospect-not-found");e.code="P404";throw e}
    const r=(await p.query(
      'INSERT INTO visibility_scans(id,prospect_id,status) VALUES($1,$2,$3) RETURNING id,prospect_id AS "prospectId",status,score,summary,findings,recommendations,provider,created_at AS "createdAt",completed_at AS "completedAt"',
      [id,prospectId,"awaiting-provider"]
    )).rows[0];
    await p.query('UPDATE prospects SET status=$2 WHERE id=$1',[prospectId,"analysis-queued"]);
    return r;
  });
  return row||{id,prospectId,status:"demo-only"};
}

export async function getProspect(prospectId){
  return await db(async p=>(await p.query('SELECT id,name,domain,sector,city,country,source,status,score,reason,created_at AS "createdAt" FROM prospects WHERE id=$1',[prospectId])).rows[0])||null
}

export async function completeProspectScan(scanId,prospectId,result){
  return await db(async p=>{
    const r=(await p.query(
      'UPDATE visibility_scans SET status=$2,score=$3,summary=$4,findings=$5::jsonb,recommendations=$6::jsonb,provider=$7,completed_at=NOW() WHERE id=$1 RETURNING id,prospect_id AS "prospectId",status,score,summary,findings,recommendations,provider,created_at AS "createdAt",completed_at AS "completedAt"',
      [scanId,"completed",result.score,result.summary||"",JSON.stringify(result.findings||[]),JSON.stringify(result.recommendations||[]),result.provider||""]
    )).rows[0];
    await p.query('UPDATE prospects SET status=$2,score=$3,reason=$4 WHERE id=$1',[prospectId,"analyzed",result.score,result.reason||""]);
    return r;
  });
}


export async function markProspectConverted(prospectId,score=null,reason=""){
  return await db(async p=>(await p.query(
    'UPDATE prospects SET status=$2,score=COALESCE($3,score),reason=CASE WHEN $4<>\'\' THEN $4 ELSE reason END WHERE id=$1 RETURNING id,name,domain,sector,city,source,status,score,reason,created_at AS "createdAt"',
    [prospectId,"converted",score,reason||""]
  )).rows[0])||null;
}


export async function getProspectNames(){
  const rows=await db(async p=>(await p.query('SELECT name FROM prospects ORDER BY created_at DESC LIMIT 500')).rows)||[];
  return rows.map(x=>x.name).filter(Boolean);
}


export async function saveProspectContact(prospectId,contact={}){
  return await db(async p=>(await p.query(
    `UPDATE prospects SET contact_email=$2,contact_url=$3,contact_source_url=$4,contact_status=$5 WHERE id=$1 RETURNING id,name,contact_email AS "contactEmail",contact_url AS "contactUrl",contact_source_url AS "contactSourceUrl",contact_status AS "contactStatus"`,
    [prospectId,contact.email||"",contact.contactUrl||"",contact.sourceUrl||"",contact.status||"not-found"]
  )).rows[0])||null
}


export async function saveProspectPersonalization(prospectId,x={}){
  return await db(async p=>(await p.query(
    `UPDATE prospects SET outreach_reason=$2,outreach_draft=$3,outreach_status=$4 WHERE id=$1 RETURNING id,name,outreach_reason AS "outreachReason",outreach_draft AS "outreachDraft",outreach_status AS "outreachStatus"`,
    [prospectId,x.reason||"",x.draft||"",x.status||"drafted"]
  )).rows[0])||null
}
