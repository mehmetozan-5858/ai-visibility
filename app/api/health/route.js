import {databaseStatus} from "../../../lib/db";
import {providerStatus} from "../../../lib/providers";
import {authConfigured} from "../../../lib/admin-auth";
import {getDashboard,listClients,listScans,listSalesPipeline,listWorkItems,listPayments} from "../../../lib/repository";
import {requireAdmin} from "../../../lib/api-security";

export const runtime="nodejs";

async function check(name,fn){
  const t=Date.now();
  try{
    const value=await fn();
    return {name,ok:true,ms:Date.now()-t,detail:value};
  }catch(e){
    return {name,ok:false,ms:Date.now()-t,error:String(e?.message||e).slice(0,220)};
  }
}

export async function GET(req){
  const denied=await requireAdmin(req);if(denied)return denied;
  const checks=await Promise.all([
    check("database",async()=>databaseStatus()),
    check("dashboard",async()=>{const d=await getDashboard();return {activeClients:d.activeClients,scansToday:d.scansToday,approvals:d.approvals,mrr:d.mrr}}),
    check("clients",async()=>({count:(await listClients()).length})),
    check("scans",async()=>({count:(await listScans(5)).length})),
    check("crm",async()=>({count:(await listSalesPipeline(5)).length})),
    check("workItems",async()=>({count:(await listWorkItems(5)).length})),
    check("payments",async()=>({count:(await listPayments(5)).length})),
    check("providers",async()=>providerStatus()),
    check("auth",async()=>({configured:authConfigured()})),
    check("paytr",async()=>({configured:Boolean(process.env.PAYTR_MERCHANT_ID&&process.env.PAYTR_MERCHANT_KEY&&process.env.PAYTR_MERCHANT_SALT)}))
  ]);
  const required=checks.filter(x=>x.name!=="paytr");
  return Response.json({
    ok:required.every(x=>x.ok),
    checkedAt:new Date().toISOString(),
    checks
  },{headers:{"cache-control":"no-store"}});
}
