import {runAuditPilot} from '../../../../lib/rd-audit-pilot.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
// Public aggregate synthetic results only; no request fields or credentials consumed.
export async function GET(){
 const result=runAuditPilot();
 return Response.json(result,{status:result.ok?200:503,headers:{
  'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'
 }});
}
