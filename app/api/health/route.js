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

function envReady(...names){return names.every(name=>Boolean(process.env[name]))}

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
    check("paytr",async()=>({configured:envReady("PAYTR_MERCHANT_ID","PAYTR_MERCHANT_KEY","PAYTR_MERCHANT_SALT")}))
  ]);
  const byName=Object.fromEntries(checks.map(x=>[x.name,x]));
  const providers=Array.isArray(byName.providers?.detail)?byName.providers.detail:[];
  const connectedProviders=providers.filter(x=>x.status==="connected").length;
  const bankTransferReady=Boolean(process.env.PAYMENT_IBAN&&process.env.PAYMENT_ACCOUNT_HOLDER&&process.env.PAYMENT_BANK_NAME);
  const hostedCheckoutReady=Boolean(process.env.SHOPIER_PRODUCTS_JSON);
  const paymentReady=Boolean(byName.paytr?.detail?.configured||bankTransferReady||hostedCheckoutReady);
  const emailReady=envReady("RESEND_API_KEY","RESEND_FROM_EMAIL");
  const gates=[
    {id:"database",label:"Veritabanı",required:true,ok:Boolean(byName.database?.ok&&byName.database?.detail?.configured),detail:byName.database?.detail?.mode||"unavailable"},
    {id:"auth",label:"Yönetici ve müşteri kimlik doğrulama",required:true,ok:Boolean(byName.auth?.ok&&byName.auth?.detail?.configured)},
    {id:"providers",label:"AI sağlayıcı",required:true,ok:connectedProviders>0,detail:`${connectedProviders}/${providers.length||3} bağlı`},
    {id:"payments",label:"Ödeme kanalı",required:true,ok:paymentReady,detail:{paytr:Boolean(byName.paytr?.detail?.configured),bankTransfer:bankTransferReady,hostedCheckout:hostedCheckoutReady}},
    {id:"email",label:"E-posta doğrulama ve bildirim",required:true,ok:emailReady},
    {id:"data",label:"Temel veri servisleri",required:true,ok:["dashboard","clients","scans","crm","workItems","payments"].every(name=>byName[name]?.ok)},
    {id:"paytr",label:"PayTR kart ödemesi",required:false,ok:Boolean(byName.paytr?.detail?.configured)}
  ];
  const requiredGates=gates.filter(x=>x.required);
  return Response.json({
    ok:requiredGates.every(x=>x.ok),
    checkedAt:new Date().toISOString(),
    launch:{ready:requiredGates.every(x=>x.ok),passed:requiredGates.filter(x=>x.ok).length,total:requiredGates.length,gates},
    checks
  },{headers:{"cache-control":"no-store"}});
}
