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
  await pool.query(`CREATE TABLE IF NOT EXISTS business_impact_metrics(
    client_id UUID PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
    monthly_traffic INTEGER,
    monthly_conversions INTEGER,
    average_value NUMERIC(14,2),
    monthly_revenue NUMERIC(14,2),
    currency TEXT NOT NULL DEFAULT 'TRY',
    evidence TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
}
function nullableInt(v){if(v===null||v===undefined||v==='')return null;const n=Math.round(Number(v));return Number.isFinite(n)&&n>=0?n:null}
function nullableMoney(v){if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)&&n>=0?Math.round(n*100)/100:null}
function clean(v,max=800){return String(v||"").trim().slice(0,max)}
export async function getBusinessImpactMetrics(clientId){
  return await withDb(async pool=>{
    const row=(await pool.query(`SELECT client_id AS "clientId",monthly_traffic AS "monthlyTraffic",monthly_conversions AS "monthlyConversions",average_value::float8 AS "averageValue",monthly_revenue::float8 AS "monthlyRevenue",currency,evidence,updated_at AS "updatedAt" FROM business_impact_metrics WHERE client_id=$1`,[clientId])).rows[0];
    return row||{clientId,monthlyTraffic:null,monthlyConversions:null,averageValue:null,monthlyRevenue:null,currency:"TRY",evidence:""};
  });
}
export async function upsertBusinessImpactMetrics(clientId,input={}){
  const currency=clean(input.currency,8).toUpperCase()||"TRY";
  return await withDb(async pool=>(await pool.query(`INSERT INTO business_impact_metrics(client_id,monthly_traffic,monthly_conversions,average_value,monthly_revenue,currency,evidence)
    VALUES($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT(client_id) DO UPDATE SET monthly_traffic=EXCLUDED.monthly_traffic,monthly_conversions=EXCLUDED.monthly_conversions,average_value=EXCLUDED.average_value,monthly_revenue=EXCLUDED.monthly_revenue,currency=EXCLUDED.currency,evidence=EXCLUDED.evidence,updated_at=NOW()
    RETURNING client_id AS "clientId",monthly_traffic AS "monthlyTraffic",monthly_conversions AS "monthlyConversions",average_value::float8 AS "averageValue",monthly_revenue::float8 AS "monthlyRevenue",currency,evidence,updated_at AS "updatedAt"`,[
      clientId,nullableInt(input.monthlyTraffic),nullableInt(input.monthlyConversions),nullableMoney(input.averageValue),nullableMoney(input.monthlyRevenue),currency,clean(input.evidence)
    ])).rows[0]);
}
