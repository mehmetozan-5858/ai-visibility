import {getDatabaseUrl} from "./db";

function normalizeDatabaseUrl(rawUrl){
  if(!rawUrl)return "";
  try{const url=new URL(rawUrl);const sslmode=url.searchParams.get("sslmode");if(["prefer","require","verify-ca"].includes(sslmode))url.searchParams.set("sslmode","verify-full");return url.toString()}catch{return rawUrl}
}
async function withDb(fn){
  const url=normalizeDatabaseUrl(getDatabaseUrl());if(!url)throw new Error("database-not-configured");
  const {Pool}=await import("pg");const pool=new Pool({connectionString:url});
  try{
    await pool.query(`CREATE TABLE IF NOT EXISTS client_profiles(
      client_id UUID PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
      country TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      sector TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      contact_email TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query("ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS requested_service TEXT NOT NULL DEFAULT ''");
    return await fn(pool);
  }finally{await pool.end()}
}
function clean(v){return String(v||"").trim()}
export async function upsertClientProfile(clientId,input={}){
  return await withDb(async pool=>(await pool.query(`INSERT INTO client_profiles(client_id,country,city,sector,phone,contact_email,requested_service)
    VALUES($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT(client_id) DO UPDATE SET country=EXCLUDED.country,city=EXCLUDED.city,sector=EXCLUDED.sector,phone=EXCLUDED.phone,contact_email=EXCLUDED.contact_email,requested_service=EXCLUDED.requested_service,updated_at=NOW()
    RETURNING client_id AS "clientId",country,city,sector,phone,contact_email AS "contactEmail",requested_service AS "requestedService",updated_at AS "updatedAt"`,
    [clientId,clean(input.country),clean(input.city),clean(input.sector),clean(input.phone),clean(input.contactEmail),clean(input.requestedService)])).rows[0]);
}
export async function getClientProfile(clientId){
  return await withDb(async pool=>(await pool.query('SELECT client_id AS "clientId",country,city,sector,phone,contact_email AS "contactEmail",requested_service AS "requestedService",updated_at AS "updatedAt" FROM client_profiles WHERE client_id=$1',[clientId])).rows[0]||null);
}
export async function listClientProfiles(){
  return await withDb(async pool=>(await pool.query('SELECT client_id AS "clientId",country,city,sector,phone,contact_email AS "contactEmail",requested_service AS "requestedService",updated_at AS "updatedAt" FROM client_profiles')).rows)||[];
}
