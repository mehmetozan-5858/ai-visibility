// Persistence boundary. Uses PostgreSQL when DATABASE_URL is configured.
// Falls back to non-persistent demo mode until a production database is connected.
import { databaseStatus } from "./db";

async function pg(){
  if(!process.env.DATABASE_URL) return null;
  const { Pool } = await import("pg");
  return new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});
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
}
export async function listClients(){
  const pool=await pg(); if(!pool) return [];
  try{await ensure(pool);const r=await pool.query("SELECT id,name,domain,plan,competitors,status,created_at AS \"createdAt\" FROM clients ORDER BY created_at DESC");return r.rows}
  finally{await pool.end()}
}
export async function getDashboard(){const clients=await listClients();return {activeClients:clients.filter(x=>x.status==="active").length,mrr:0,scansToday:0,approvals:0,database:databaseStatus()}}
export async function addClient(input){
  const id=crypto.randomUUID(), createdAt=new Date().toISOString();
  const pool=await pg();
  if(!pool)return {id,...input,status:"demo-only",createdAt,persisted:false};
  try{await ensure(pool);const r=await pool.query(
    'INSERT INTO clients(id,name,domain,plan,competitors,status) VALUES($1,$2,$3,$4,$5::jsonb,$6) RETURNING id,name,domain,plan,competitors,status,created_at AS "createdAt"',
    [id,input.name,input.domain,input.plan||"Starter",JSON.stringify(input.competitors||[]),"active"]);return {...r.rows[0],persisted:true}}
  finally{await pool.end()}
}