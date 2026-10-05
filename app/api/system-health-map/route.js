import {listSystemWatchdog} from "../../../lib/agent-coordination";
import {requireAdmin} from "../../../lib/api-security";
export const runtime="nodejs";
export async function GET(req){
 const auth=await requireAdmin(req);if(auth?.response)return auth.response;
 try{
  const items=await listSystemWatchdog(),now=Date.now();
  const components=items.map(x=>{
   const last=x.lastSuccessAt?new Date(x.lastSuccessAt).getTime():0,ageMinutes=last?Math.max(0,Math.floor((now-last)/60000)):null;
   const stale=ageMinutes===null||ageMinutes>Number(x.expectedIntervalMinutes||60)*2;
   const state=x.quarantineUntil&&new Date(x.quarantineUntil)>new Date()?"quarantined":x.severity==="critical"?"critical":stale?"delayed":x.lastStatus==="healthy"?"healthy":"warning";
   return {...x,ageMinutes,state};
  });
  const counts=components.reduce((a,x)=>(a[x.state]=(a[x.state]||0)+1,a),{});
  return Response.json({ok:true,counts,components,generatedAt:new Date().toISOString()},{headers:{"cache-control":"no-store"}});
 }catch(e){return Response.json({ok:false,error:String(e?.message||e).slice(0,180)},{status:500})}
}
