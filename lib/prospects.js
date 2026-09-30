import {getDatabaseUrl} from "./db";

async function db(fn){
  const url=getDatabaseUrl(); if(!url) return null;
  const {Pool}=await import("pg");
  const p=new Pool({connectionString:url,ssl:{rejectUnauthorized:false}});
  try{
    await p.query(`CREATE TABLE IF NOT EXISTS prospects(
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      domain TEXT NOT NULL DEFAULT '',
      sector TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'manual',
      status TEXT NOT NULL DEFAULT 'new',
      score INTEGER,
      reason TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
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
  return await db(async p=>(await p.query(`SELECT p.id,p.name,p.domain,p.sector,p.city,p.source,p.status,p.score,p.reason,p.created_at AS "createdAt",
    (SELECT vs.status FROM visibility_scans vs WHERE vs.prospect_id=p.id ORDER BY vs.created_at DESC LIMIT 1) AS "scanStatus"
    FROM prospects p ORDER BY p.created_at DESC`)).rows)||[]
}

export async function addProspect(x){
  const id=crypto.randomUUID();
  const r=await db(async p=>(await p.query(
    'INSERT INTO prospects(id,name,domain,sector,city,source) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,name,domain,sector,city,source,status,score,reason,created_at AS "createdAt"',
    [id,x.name,x.domain,x.sector,x.city,x.source]
  )).rows[0]);
  return r||{id,...x,status:"demo-only"}
}

export async function seedProspects(items=[]){
  const out=[];
  for(const x of items){
    const existing=await db(async p=>(await p.query(
      'SELECT id,name,domain,sector,city,source,status,score,reason,created_at AS "createdAt" FROM prospects WHERE lower(name)=lower($1) LIMIT 1',[x.name]
    )).rows[0]);
    if(existing){out.push(existing);continue}
    out.push(await addProspect(x))
  }
  return out
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
