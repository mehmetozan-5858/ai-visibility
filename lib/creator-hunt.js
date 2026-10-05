import crypto from "node:crypto";
import {getDatabaseUrl} from "./db";

function dbUrl(){return getDatabaseUrl()||""}
async function withDb(fn){const url=dbUrl();if(!url)throw new Error("database-not-configured");const {Pool}=await import("pg");const pool=new Pool({connectionString:url});try{await pool.query(`CREATE TABLE IF NOT EXISTS creator_hunt_leads(
 id UUID PRIMARY KEY, platform TEXT NOT NULL, handle TEXT NOT NULL DEFAULT '', display_name TEXT NOT NULL,
 profile_url TEXT NOT NULL DEFAULT '', niche TEXT NOT NULL DEFAULT '', country TEXT NOT NULL DEFAULT '',
 language TEXT NOT NULL DEFAULT '', public_contact TEXT NOT NULL DEFAULT '', source_url TEXT NOT NULL DEFAULT '',
 opportunity_score INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'new',
 evidence JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(platform,profile_url)
)`);return await fn(pool)}finally{await pool.end()}}
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
