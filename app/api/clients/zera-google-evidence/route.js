import {requireAdmin,enforceSameOrigin} from '../../../../lib/api-security';
import {findClientByIdentity} from '../../../../lib/repository';
import {databasePool} from '../../../../lib/database-runtime';
import {getDatabaseUrl} from '../../../../lib/db';
import {ZERA_TASKS} from '../../../../lib/zera-evidence-orchestrator.mjs';
import {validateZeraGoogleEvidence} from '../../../../lib/zera-google-evidence-validation.mjs';

const headers={'Cache-Control':'private, no-store'};
const tasks=ZERA_TASKS.filter(t=>t.channel==='google');
async function context(){
 const client=await findClientByIdentity('ZERA Clothing','');
 if(!client?.id||client.name!=='ZERA Clothing'||client.plan!=='Pilot')throw Error('pilot-missing');
 const url=getDatabaseUrl();if(!url)throw Error('db-missing');
 return {client,pool:databasePool(url)};
}
export async function GET(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 try{
  const {client,pool}=await context();
  const table=await pool.query("SELECT to_regclass('public.zera_google_evidence_reviews') AS name");
  const rows=table.rows[0]?.name?await pool.query('SELECT task_id AS "taskId",query,source_url AS "sourceUrl",observation,status,created_at AS "createdAt" FROM zera_google_evidence_reviews WHERE client_id=$1 ORDER BY created_at DESC LIMIT 50',[client.id]):{rows:[]};
  return Response.json({tasks,observations:rows.rows,verified:0,note:'All collected records await independent source verification; not counted in ZERA 0/7.'},{headers});
 }catch{return Response.json({error:'Google evidence status unavailable'},{status:503,headers})}
}
export async function POST(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 const origin=enforceSameOrigin(req);if(origin)return origin;
 // Recording a source for human review never performs a search or verifies the claim.
 let body;try{body=await req.json()}catch{return Response.json({error:'Invalid JSON'},{status:400,headers})}
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['taskId','query','sourceUrl','observation','verified','claimsZeraIdentity'].includes(k)))
  return Response.json({error:'Invalid evidence fields'},{status:400,headers});
 // Identity claims must never be inferred from an ambiguous business name.
 const checked=validateZeraGoogleEvidence({...body,verified:true});
 if(!checked.ok)return Response.json({error:checked.reason},{status:400,headers});
 // Refuse caller-asserted verification. No API-only path to upgrade status to verified.
 if(body.verified===true)return Response.json({error:'Independent verification not available; submit an unverified review candidate'},{status:409,headers});
 try{
  const {client,pool}=await context(),e=checked.evidence;
  await pool.query(`CREATE TABLE IF NOT EXISTS zera_google_evidence_reviews(
    client_id UUID NOT NULL, task_id TEXT NOT NULL, source_url TEXT NOT NULL,
    query TEXT NOT NULL, observation TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending-review', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(client_id,task_id,source_url))`);
  const inserted=await pool.query("INSERT INTO zera_google_evidence_reviews(client_id,task_id,source_url,query,observation,status) VALUES($1,$2,$3,$4,$5,'pending-review') ON CONFLICT DO NOTHING RETURNING task_id",[client.id,e.taskId,e.sourceUrl,e.query,e.observation]);
  return Response.json({recorded:inserted.rows.length>0,status:'pending-review',verified:false,visibilityScore:null},{status:inserted.rows.length?201:200,headers});
 }catch{return Response.json({error:'Evidence staging unavailable'},{status:503,headers})}
}
