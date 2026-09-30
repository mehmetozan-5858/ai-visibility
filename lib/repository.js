// Persistent repository backed by PostgreSQL/Neon when DATABASE_URL is present.
import { databaseStatus,getDatabaseUrl } from "./db";

async function withDb(fn){
  const url=getDatabaseUrl(); if(!url) return null;
  const { Pool } = await import("pg");
  const pool = new Pool({connectionString:url,ssl:{rejectUnauthorized:false}});
  try{ await ensure(pool); return await fn(pool); }
  finally{ await pool.end(); }
}

async function ensure(pool){
  await pool.query(`CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    domain TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'Starter',
    competitors JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS scans (
    id UUID PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    queries JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'queued',
    score INTEGER,
    results JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
  )`);
}

export async function listClients(){
  const rows=await withDb(async pool=>(await pool.query(
    'SELECT id,name,domain,plan,competitors,status,created_at AS "createdAt" FROM clients ORDER BY created_at DESC'
  )).rows);
  return rows||[];
}

export async function addClient(input){
  const id=crypto.randomUUID(), createdAt=new Date().toISOString();
  const row=await withDb(async pool=>(await pool.query(
    'INSERT INTO clients(id,name,domain,plan,competitors,status) VALUES($1,$2,$3,$4,$5::jsonb,$6) RETURNING id,name,domain,plan,competitors,status,created_at AS "createdAt"',
    [id,input.name,input.domain,input.plan||"Starter",JSON.stringify(input.competitors||[]),"active"]
  )).rows[0]);
  return row?{...row,persisted:true}:{id,...input,status:"demo-only",createdAt,persisted:false};
}

export async function createScan(clientId,queries=[]){
  const id=crypto.randomUUID(), createdAt=new Date().toISOString();
  const row=await withDb(async pool=>(await pool.query(
    'INSERT INTO scans(id,client_id,queries,status) VALUES($1,$2,$3::jsonb,$4) RETURNING id,client_id AS "clientId",queries,status,score,results,created_at AS "createdAt",completed_at AS "completedAt"',
    [id,clientId,JSON.stringify(Array.isArray(queries)?queries:[]),"queued"]
  )).rows[0]);
  return row?{...row,persisted:true}:{id,clientId,queries,status:"demo-only",createdAt,persisted:false};
}

export async function listScans(limit=50){
  const safe=Math.max(1,Math.min(Number(limit)||50,100));
  const rows=await withDb(async pool=>(await pool.query(
    'SELECT s.id,s.client_id AS "clientId",c.name AS "clientName",s.queries,s.status,s.score,s.results,s.created_at AS "createdAt",s.completed_at AS "completedAt" FROM scans s JOIN clients c ON c.id=s.client_id ORDER BY s.created_at DESC LIMIT $1',
    [safe]
  )).rows);
  return rows||[];
}

export async function getDashboard(){
  const data=await withDb(async pool=>{
    const r=await pool.query(`SELECT
      (SELECT COUNT(*)::int FROM clients WHERE status='active') AS "activeClients",
      (SELECT COUNT(*)::int FROM scans WHERE created_at >= CURRENT_DATE) AS "scansToday"`);
    return r.rows[0];
  });
  return {activeClients:data?.activeClients||0,mrr:0,scansToday:data?.scansToday||0,approvals:0,database:databaseStatus()};
}
