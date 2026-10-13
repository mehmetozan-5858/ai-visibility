import pg from 'pg';
import {sandboxDatabaseUrl} from '../../../../lib/paddle-sandbox';
import {checkoutIntentRequest,createSandboxCheckoutIntent} from '../../../../lib/paddle-sandbox-identity';
export const runtime='nodejs';
const headers={'cache-control':'no-store'};
export async function POST(req){
 const input=await checkoutIntentRequest(req);
 if(input.status!==200)return Response.json({error:input.status===401?'Müşteri oturumu gerekli.':'Test ödeme isteği reddedildi.'},{status:input.status,headers});
 const url=sandboxDatabaseUrl();if(!url)return Response.json({error:'İzole test deposu yapılandırılmalı.'},{status:503,headers});
 const pool=new pg.Pool({connectionString:url,max:1,connectionTimeoutMillis:3000});
 try{return Response.json(await createSandboxCheckoutIntent(input,pool),{headers})}
 catch{return Response.json({error:'Test ödeme referansı oluşturulamadı.'},{status:503,headers})}
 finally{await pool.end()}
}
