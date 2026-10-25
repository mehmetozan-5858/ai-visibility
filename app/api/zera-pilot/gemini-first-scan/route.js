import {requireAdmin,enforceSameOrigin} from '../../../../lib/api-security';
import {databasePool} from '../../../../lib/database-runtime';
import {getDatabaseUrl} from '../../../../lib/db';
import {zeraRegistrationGate} from '../../../../pilot/zera-registration-gate.mjs';
import {compareCustomerProviders} from '../../../../lib/customer-provider-comparison.mjs';
import {buildAuditQueue} from '../../../../pilot/zera-audit-queue.mjs';

/** One deliberately triggered Gemini-only pilot query, never an automated worker. */
export async function POST(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 const origin=enforceSameOrigin(req);if(origin)return origin;
 const gate=zeraRegistrationGate(process.env);
 if(!gate.allowed||process.env.VERCEL_GIT_COMMIT_REF!=='feat/zera-pilot-full-package')
  return Response.json({error:'Isolated preview required'},{status:403});
 if(process.env.ZERA_GEMINI_FREE_TIER_CONFIRMED!=='true')
  return Response.json({error:'Free-tier eligibility has not been confirmed'},{status:409});
 if(!process.env.GEMINI_API_KEY)return Response.json({error:'Gemini key missing'},{status:409});
 let body;
 try{body=await req.json()}catch{return Response.json({error:'Invalid request'},{status:400})}
 if(body?.confirmSingleGeminiScan!==true||Object.keys(body).length!==1)
  return Response.json({error:'Explicit single-scan confirmation required'},{status:400});
 const url=getDatabaseUrl();
 if(!url)return Response.json({error:'Isolated database unavailable'},{status:503});
 const pool=databasePool(url);
 await pool.query('CREATE TABLE IF NOT EXISTS zera_first_gemini_attempts (id TEXT PRIMARY KEY, created_at TIMESTAMPTZ DEFAULT NOW(), result JSONB)');
 const claim=await pool.query("INSERT INTO zera_first_gemini_attempts(id) VALUES('ZERA-GEMINI-INITIAL') ON CONFLICT DO NOTHING RETURNING id");
 if(!claim.rows.length)return Response.json({error:'Initial scan already attempted; no duplicate API call permitted'},{status:409});
 const task=buildAuditQueue().find(item=>item.id==='brand-ai-de');
 const client={id:'ZERA-DE-001',name:'ZERA Clothing'};
 const comparison=await compareCustomerProviders({client,query:task.query,providers:['gemini'],keys:{gemini:process.env.GEMINI_API_KEY}});
 await pool.query('UPDATE zera_first_gemini_attempts SET result=$1 WHERE id=$2',[JSON.stringify(comparison),'ZERA-GEMINI-INITIAL']);
 return Response.json({comparison,warning:'One observed provider answer is not a verified visibility ranking.'},{headers:{'Cache-Control':'private, no-store'}});
}

export async function GET(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 const gate=zeraRegistrationGate(process.env);
 if(!gate.allowed)return Response.json({error:'Isolated preview required'},{status:403});
 const pool=databasePool(getDatabaseUrl());
 const exists=await pool.query("SELECT to_regclass('public.zera_first_gemini_attempts') AS table_name");
 if(!exists.rows[0]?.table_name)return Response.json({status:'not-started',provider:'gemini'},{headers:{'Cache-Control':'private, no-store'}});
 const result=await pool.query("SELECT created_at,result FROM zera_first_gemini_attempts WHERE id='ZERA-GEMINI-INITIAL'");
 const entry=result.rows[0];
 return Response.json(entry?{status:entry.result?(entry.result.results?.some(r=>r.status==='failed'||r.status==='empty-answer'||r.status==='not-configured')?'failed':'response-recorded'):'attempt-started',createdAt:entry.created_at,comparison:entry.result}:{status:'not-started',provider:'gemini'},{headers:{'Cache-Control':'private, no-store'}});
}
