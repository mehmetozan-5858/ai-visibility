import {requireAdmin,enforceSameOrigin} from '../../../../lib/api-security';
import {findClientByIdentity} from '../../../../lib/repository';
import {databasePool} from '../../../../lib/database-runtime';
import {getDatabaseUrl} from '../../../../lib/db';
import {createRetiredLegacyPost} from '../../../../lib/zera-legacy-retirement.mjs';

// Retired, superseded writer. No provider, task claim, comparison write or retries.
export const POST=createRetiredLegacyPost({authorize:requireAdmin,checkOrigin:enforceSameOrigin});

/** Admin-only read of the old one-shot attempt; never starts provider calls. */
export async function GET(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 if(process.env.VERCEL_ENV!=='production')return Response.json({error:'Production only'},{status:403});
 try{
  const client=await findClientByIdentity('ZERA Clothing','');
  if(!client?.id||client.plan!=='Pilot')return Response.json({error:'ZERA Pilot missing'},{status:404});
  const db=getDatabaseUrl();if(!db)return Response.json({error:'Database unavailable'},{status:503});
  const pool=databasePool(db);
  const exists=await pool.query("SELECT to_regclass('public.zera_production_scan_attempts') AS table_name");
  if(!exists.rows[0]?.table_name)return Response.json({status:'not-started',attemptUsed:false},{headers:{'Cache-Control':'private, no-store'}});
  const result=await pool.query("SELECT status,created_at AS \"createdAt\" FROM zera_production_scan_attempts WHERE id='first-free-gemini' AND client_id=$1 LIMIT 1",[client.id]);
  return Response.json(result.rows[0]?{status:result.rows[0].status,createdAt:result.rows[0].createdAt,attemptUsed:true}:{status:'not-started',attemptUsed:false},{headers:{'Cache-Control':'private, no-store'}});
 }catch{return Response.json({error:'Attempt status unavailable'},{status:503})}
}
