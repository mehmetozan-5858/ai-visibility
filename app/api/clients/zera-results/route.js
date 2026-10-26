import {requireAdmin} from '../../../../lib/api-security';
import {findClientByIdentity} from '../../../../lib/repository';
import {databasePool} from '../../../../lib/database-runtime';
import {getDatabaseUrl} from '../../../../lib/db';
import {projectZeraResults} from '../../../../lib/zera-results-view.mjs';

/** Read only: no provider calls, writes, migrations, or billing. */
export async function GET(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 try{
  const client=await findClientByIdentity('ZERA Clothing','');
  if(!client||client.name!=='ZERA Clothing'||client.plan!=='Pilot')
   return Response.json({error:'ZERA Pilot not found'},{status:404});
  const pool=databasePool(getDatabaseUrl());
  const hasTable=await pool.query("SELECT to_regclass('public.ai_provider_comparisons') AS table_name");
  if(!hasTable.rows[0]?.table_name)
   return Response.json({clientId:client.id,comparisons:[],verifiedCount:0},{headers:{'Cache-Control':'private, no-store'}});
  const rows=await pool.query('SELECT id,query,results,created_at AS "createdAt" FROM ai_provider_comparisons WHERE client_id=$1 ORDER BY created_at DESC LIMIT 20',[client.id]);
  const comparisons=projectZeraResults(rows.rows);
  return Response.json({clientId:client.id,comparisons,verifiedCount:comparisons.reduce((a,c)=>a+c.results.filter(x=>x.verified).length,0)},{headers:{'Cache-Control':'private, no-store'}});
 }catch{return Response.json({error:'Results unavailable'},{status:503})}
}

