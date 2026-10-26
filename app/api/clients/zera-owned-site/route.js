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
  return Response.json({...result,saved:false,googleTasksCompleted:0,visibilityScore:null},{headers});
 }catch{
  return Response.json({status:'source-unavailable',saved:false,googleTasksCompleted:0,visibilityScore:null},{status:502,headers});
 }
}
