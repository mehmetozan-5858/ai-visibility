import {sandboxEnabled} from '../../../../lib/paddle-sandbox';
import {createSandboxSession,SANDBOX_SESSION_COOKIE} from '../../../../lib/paddle-sandbox-session';
import {checkRateLimit} from '../../../../lib/api-security';
export const runtime='nodejs';
const headers={'cache-control':'no-store'};
export async function POST(req){
 if(!sandboxEnabled())return Response.json({error:'Sandbox disabled'},{status:404,headers});
 if(req.headers.get('origin')!==new URL(req.url).origin||!/^application\/json(?:;|$)/i.test(req.headers.get('content-type')||''))return Response.json({error:'Test oturumu isteği reddedildi.'},{status:403,headers});
 const limited=checkRateLimit(req,{bucket:'sandbox-fixture-session',limit:6,windowMs:15*60*1000});if(limited)return limited;
 try{
  const body=await req.json();if(!body||Array.isArray(body)||Object.keys(body).length)return Response.json({error:'Test oturumu isteği reddedildi.'},{status:400,headers});
  const token=createSandboxSession();
  const response=Response.json({ok:true,testOnly:true,productionAccessChanged:false},{headers});
  response.headers.append('set-cookie',`${SANDBOX_SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=3600`);
  return response;
 }catch{return Response.json({error:'Sentetik test oturumu hazırlanamadı.'},{status:503,headers})}
}
