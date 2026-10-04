import {getDatabaseUrl} from "./db";

function normalizeDatabaseUrl(rawUrl){
  if(!rawUrl)return "";
  try{const url=new URL(rawUrl);const sslmode=url.searchParams.get("sslmode");if(["prefer","require","verify-ca"].includes(sslmode))url.searchParams.set("sslmode","verify-full");return url.toString()}catch{return rawUrl}
}
async function withDb(fn){
  const url=normalizeDatabaseUrl(getDatabaseUrl());if(!url)throw new Error("database-not-configured");
  const {Pool}=await import("pg");const pool=new Pool({connectionString:url});
  try{await ensure(pool);return await fn(pool)}finally{await pool.end()}
}
async function ensure(pool){
  await pool.query(`CREATE TABLE IF NOT EXISTS commerce_signals(
    client_id UUID PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
    catalog_status TEXT NOT NULL DEFAULT 'unknown',
    catalog_evidence TEXT NOT NULL DEFAULT '',
    pricing_status TEXT NOT NULL DEFAULT 'unknown',
    pricing_evidence TEXT NOT NULL DEFAULT '',
    availability_status TEXT NOT NULL DEFAULT 'unknown',
    availability_evidence TEXT NOT NULL DEFAULT '',
    purchase_path_status TEXT NOT NULL DEFAULT 'unknown',
    purchase_path_evidence TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
}
const allowed=new Set(["unknown","partial","verified"]);
function clean(v){return String(v||"").trim().slice(0,500)}
export async function getCommerceSignals(clientId){
  return await withDb(async pool=>{
    const row=(await pool.query(`SELECT client_id AS "clientId",catalog_status AS "catalogStatus",catalog_evidence AS "catalogEvidence",pricing_status AS "pricingStatus",pricing_evidence AS "pricingEvidence",availability_status AS "availabilityStatus",availability_evidence AS "availabilityEvidence",purchase_path_status AS "purchasePathStatus",purchase_path_evidence AS "purchasePathEvidence",updated_at AS "updatedAt" FROM commerce_signals WHERE client_id=$1`,[clientId])).rows[0];
    return row||{clientId,catalogStatus:"unknown",catalogEvidence:"",pricingStatus:"unknown",pricingEvidence:"",availabilityStatus:"unknown",availabilityEvidence:"",purchasePathStatus:"unknown",purchasePathEvidence:""};
  });
}
export async function upsertCommerceSignals(clientId,input={}){
  const pick=(v)=>allowed.has(v)?v:"unknown";
  return await withDb(async pool=>{
    const row=(await pool.query(`INSERT INTO commerce_signals(client_id,catalog_status,catalog_evidence,pricing_status,pricing_evidence,availability_status,availability_evidence,purchase_path_status,purchase_path_evidence)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT(client_id) DO UPDATE SET catalog_status=EXCLUDED.catalog_status,catalog_evidence=EXCLUDED.catalog_evidence,pricing_status=EXCLUDED.pricing_status,pricing_evidence=EXCLUDED.pricing_evidence,availability_status=EXCLUDED.availability_status,availability_evidence=EXCLUDED.availability_evidence,purchase_path_status=EXCLUDED.purchase_path_status,purchase_path_evidence=EXCLUDED.purchase_path_evidence,updated_at=NOW()
      RETURNING client_id AS "clientId",catalog_status AS "catalogStatus",catalog_evidence AS "catalogEvidence",pricing_status AS "pricingStatus",pricing_evidence AS "pricingEvidence",availability_status AS "availabilityStatus",availability_evidence AS "availabilityEvidence",purchase_path_status AS "purchasePathStatus",purchase_path_evidence AS "purchasePathEvidence",updated_at AS "updatedAt"`,[
        clientId,pick(input.catalogStatus),clean(input.catalogEvidence),pick(input.pricingStatus),clean(input.pricingEvidence),pick(input.availabilityStatus),clean(input.availabilityEvidence),pick(input.purchasePathStatus),clean(input.purchasePathEvidence)
      ])).rows[0];
    return row;
  });
}
