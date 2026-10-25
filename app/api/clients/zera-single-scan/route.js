import {requireAdmin,enforceSameOrigin} from '../../../../lib/api-security';
import {findClientByIdentity} from '../../../../lib/repository';
import {compareCustomerProviders} from '../../../../lib/customer-provider-comparison.mjs';
import {storeCustomerComparison} from '../../../../lib/customer-comparison-storage.mjs';
import {databasePool} from '../../../../lib/database-runtime';
import {getDatabaseUrl} from '../../../../lib/db';

// Operator-triggered, one-attempt pilot. DISABLED unless explicitly enabled.
// No cron, no OpenAI/Perplexity billing, no automatic retries.
export async function POST(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 const origin=enforceSameOrigin(req);if(origin)return origin;
 if(process.env.VERCEL_ENV!=='production'||process.env.ZERA_SINGLE_SCAN_ENABLED!=='true')
  return Response.json({error:'ZERA single scan disabled'},{status:403});
 if(process.env.ZERA_GEMINI_FREE_TIER_CONFIRMED!=='true'||process.env.ZERA_GEMINI_SEARCH_GROUNDING_ENABLED==='true')
  return Response.json({error:'Free non-grounded Gemini mode required'},{status:409});
 if(!process.env.GEMINI_API_KEY)return Response.json({error:'Gemini credentials missing'},{status:409});
 let body;try{body=await req.json()}catch{return Response.json({error:'Invalid JSON'},{status:400})}
 if(body?.confirmOneFreeGeminiAttempt!==true||Object.keys(body).length!==1)
  return Response.json({error:'Explicit confirmation required'},{status:400});
 try{
  const client=await findClientByIdentity('ZERA Clothing','');
  if(!client||client.name!=='ZERA Clothing'||client.plan!=='Pilot')return Response.json({error:'ZERA Pilot missing'},{status:404});
  const url=getDatabaseUrl();if(!url)return Response.json({error:'Database unavailable'},{status:503});
  const pool=databasePool(url);
  await pool.query('CREATE TABLE IF NOT EXISTS zera_production_scan_attempts (id TEXT PRIMARY KEY,client_id UUID NOT NULL,created_at TIMESTAMPTZ DEFAULT NOW(),status TEXT NOT NULL)');
  const claim=await pool.query("INSERT INTO zera_production_scan_attempts(id,client_id,status) VALUES('first-free-gemini', $1, 'started') ON CONFLICT DO NOTHING RETURNING id",[client.id]);
  if(!claim.rows.length)return Response.json({error:'One attempt already used or running; no retry allowed'},{status:409});
  const comparison=await compareCustomerProviders({client,query:'Welche Modeboutiquen gibt es in Wetzlar?',providers:['gemini'],keys:{gemini:process.env.GEMINI_API_KEY}});
  const received=comparison.results.some(r=>r.status==='source-supported-answer'||r.status==='answer-received-unverified');
  if(!received){
   await pool.query("UPDATE zera_production_scan_attempts SET status='provider-failed' WHERE id='first-free-gemini'");
   return Response.json({status:'provider-failed',results:comparison.results.map(r=>({provider:r.provider,status:r.status,reason:r.reason||null})),saved:false},{status:502});
  }
  const saved=await storeCustomerComparison({clientId:client.id,comparison});
  await pool.query("UPDATE zera_production_scan_attempts SET status='stored' WHERE id='first-free-gemini'");
  return Response.json({status:'stored',saved:true,comparisonId:saved.id,verifiedCount:comparison.verifiedCount,visibilityScore:null},{headers:{'Cache-Control':'private, no-store'}});
 }catch{return Response.json({error:'Attempt failed; verify state before any retry'},{status:503})}
}
