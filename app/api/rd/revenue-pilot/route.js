import {runRevenuePilot} from '../../../../lib/rd-revenue-pilot.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
 const result=runRevenuePilot();
 return Response.json(result,{status:result.ok?200:503,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}});
}
