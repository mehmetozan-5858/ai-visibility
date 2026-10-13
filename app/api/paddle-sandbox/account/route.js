import pg from 'pg';
import {sandboxEnabled,sandboxDatabaseUrl} from '../../../../lib/paddle-sandbox';
import {sandboxClientSession} from '../../../../lib/paddle-sandbox-identity';
export const runtime='nodejs';
const headers={'cache-control':'no-store'};
export async function GET(req){
 if(!sandboxEnabled())return Response.json({error:'Sandbox disabled'},{status:404,headers});
 const session=await sandboxClientSession(req);if(!session)return Response.json({error:'Müşteri oturumu gerekli.'},{status:401,headers});
 const url=sandboxDatabaseUrl();if(!url)return Response.json({error:'İzole test deposu yapılandırılmalı.'},{status:503,headers});
 const pool=new pg.Pool({connectionString:url,max:1,connectionTimeoutMillis:3000});
 try{const result=await pool.query(`SELECT i.service_code,e.status,e.event_type FROM paddle_sandbox_checkout_intents i JOIN paddle_sandbox_entities e ON e.entity_id=COALESCE(i.subscription_id,i.initial_transaction_id) WHERE i.client_id=$1 ORDER BY i.created_at DESC LIMIT 20`,[session.clientId]);return Response.json({records:result.rows,productionAccessChanged:false},{headers})}
 catch{return Response.json({error:'Test abonelik durumu okunamadı.'},{status:503,headers})}
 finally{await pool.end()}
}
