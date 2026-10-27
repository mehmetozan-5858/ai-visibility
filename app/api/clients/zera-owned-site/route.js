import {findClientByIdentity} from '../../../../lib/repository';
import {databasePool} from '../../../../lib/database-runtime';
import {getDatabaseUrl} from '../../../../lib/db';
import {requireAdmin,enforceSameOrigin} from '../../../../lib/api-security';
import {collectZeraOwnedSite} from '../../../../lib/zera-owned-site-collector.mjs';
const headers={'Cache-Control':'private, no-store'};
export async function POST(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 const origin=enforceSameOrigin(req);if(origin)return origin;
 let body;try{body=await req.json()}catch{return Response.json({error:'Invalid JSON'},{status:400,headers})}
 if(!body||Object.keys(body).length!==1||body.collectFirstPartySource!==true)
  return Response.json({error:'Explicit first-party collection request required'},{status:400,headers});
 try{
  const result=await collectZeraOwnedSite();
  if(result.status!=='collected'||!result.title)return Response.json({...result,saved:false,googleTasksCompleted:0,visibilityScore:null},{headers});
  const client=await findClientByIdentity('ZERA Clothing','');
  const url=getDatabaseUrl();
  if(!client?.id||client.name!=='ZERA Clothing'||client.plan!=='Pilot'||!url)
   return Response.json({error:'Pilot storage unavailable',saved:false,googleTasksCompleted:0,visibilityScore:null},{status:503,headers});
  const pool=databasePool(url);
  await pool.query(`CREATE TABLE IF NOT EXISTS zera_owned_site_observations(
    client_id UUID NOT NULL,source_url TEXT NOT NULL,title TEXT NOT NULL,
    collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(client_id,source_url))`);
  const written=await pool.query(`INSERT INTO zera_owned_site_observations(client_id,source_url,title)
    VALUES($1,$2,$3) ON CONFLICT(client_id,source_url)
    DO UPDATE SET title=EXCLUDED.title,collected_at=NOW() RETURNING collected_at`,
    [client.id,result.sourceUrl,result.title]);
  return Response.json({...result,saved:written.rows.length===1,verified:false,googleTasksCompleted:0,visibilityScore:null},{headers});
 }catch{
  return Response.json({status:'collection-or-storage-unavailable',saved:false,googleTasksCompleted:0,visibilityScore:null},{status:503,headers});
 }
}

export async function GET(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 try{
  const client=await findClientByIdentity('ZERA Clothing','');
  const url=getDatabaseUrl();
  if(!client?.id||client.name!=='ZERA Clothing'||client.plan!=='Pilot'||!url)
   return Response.json({status:'unavailable',verified:false,googleTasksCompleted:0,visibilityScore:null},{status:503,headers});
  const pool=databasePool(url);
  const table=await pool.query("SELECT to_regclass('public.zera_owned_site_observations') AS name");
  if(!table.rows[0]?.name)
   return Response.json({status:'not-collected',observations:[],verified:false,googleTasksCompleted:0,visibilityScore:null},{headers});
  const observed=await pool.query('SELECT source_url AS "sourceUrl",title,collected_at AS "collectedAt" FROM zera_owned_site_observations WHERE client_id=$1 ORDER BY collected_at DESC LIMIT 10',[client.id]);
  return Response.json({status:observed.rows.length?'collected-unverified':'not-collected',observations:observed.rows,verified:false,googleTasksCompleted:0,visibilityScore:null},{headers});
 }catch{
  return Response.json({status:'status-unavailable',verified:false,googleTasksCompleted:0,visibilityScore:null},{status:503,headers});
 }
}
