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

async function withDb(fn){
  const url=normalizeDatabaseUrl(getDatabaseUrl());
  if(!url)throw new Error("database-not-configured");
  const {Pool}=await import("pg");
  const pool=new Pool({connectionString:url});
  try{
    await pool.query(`CREATE TABLE IF NOT EXISTS customer_leads(
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      business_name TEXT NOT NULL,
      website TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      sector TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'new',
      source TEXT NOT NULL DEFAULT 'website',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query("ALTER TABLE customer_leads ADD COLUMN IF NOT EXISTS requested_service TEXT NOT NULL DEFAULT ''");
    return await fn(pool);
  }finally{await pool.end()}
}

function clean(v,max=240){return String(v||"").trim().slice(0,max)}

export async function createLead(input={}){
  const name=clean(input.name,120),businessName=clean(input.businessName,160),email=clean(input.email,180).toLowerCase();
  if(name.length<2||businessName.length<2||!email.includes("@"))throw new Error("invalid-lead");
  const id=crypto.randomUUID();
  return await withDb(async pool=>(await pool.query(
    `INSERT INTO customer_leads(id,name,business_name,website,country,city,sector,email,phone,status,source,requested_service)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'new','website',$10)
     RETURNING id,name,business_name AS "businessName",website,country,city,sector,email,phone,requested_service AS "requestedService",status,source,created_at AS "createdAt"`,
    [id,name,businessName,clean(input.website,240),clean(input.country,120),clean(input.city,120),clean(input.sector,120),email,clean(input.phone,80),clean(input.service,80)]
  )).rows[0]);
}

export async function listLeads(limit=100){
  const safe=Math.max(1,Math.min(Number(limit)||100,200));
  return await withDb(async pool=>(await pool.query(
    `SELECT id,name,business_name AS "businessName",website,country,city,sector,email,phone,requested_service AS "requestedService",status,source,created_at AS "createdAt",updated_at AS "updatedAt"
     FROM customer_leads ORDER BY created_at DESC LIMIT $1`,[safe]
  )).rows)||[];
}

export async function updateLeadStatus(id,status){
  const allowed=new Set(["new","contacted","qualified","proposal","won","lost"]);
  if(!allowed.has(status))throw new Error("invalid-lead-status");
  return await withDb(async pool=>(await pool.query(
    `UPDATE customer_leads SET status=$2,updated_at=NOW() WHERE id=$1
     RETURNING id,name,business_name AS "businessName",website,country,city,sector,email,phone,status,source,created_at AS "createdAt",updated_at AS "updatedAt"`,
    [id,status]
  )).rows[0]||null);
}

export async function getLead(id){
  return await withDb(async pool=>(await pool.query(`SELECT id,name,business_name AS "businessName",website,country,city,sector,email,phone,requested_service AS "requestedService",status,source,created_at AS "createdAt" FROM customer_leads WHERE id=$1`,[id])).rows[0]||null);
}
