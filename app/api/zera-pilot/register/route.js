import {requireAdmin,enforceSameOrigin} from '../../../../lib/api-security';
import {registerZeraPilot} from '../../../../pilot/zera-register.mjs';
import {getClient,createScan,listScans} from '../../../../lib/repository';
import {AUDIT_TASKS} from '../../../../pilot/zera-audit-queue.mjs';
import {zeraRegistrationGate} from '../../../../pilot/zera-registration-gate.mjs';
export async function POST(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 const badOrigin=enforceSameOrigin(req);if(badOrigin)return badOrigin;
 // Preview cannot write until dedicated isolation has been independently verified.
 const gate=zeraRegistrationGate(process.env);
 if(!gate.allowed)return Response.json({error:'Pilot registration unavailable',reason:gate.reason},{status:409,headers:{'Cache-Control':'private, no-store'}});
 try{
  const body=await req.json();
  if(body?.pilotId!=='ZERA-DE-001'||body?.confirmPublicPilot!==true)
   return Response.json({error:'Explicit ZERA public pilot confirmation required'},{status:400});
  const result=await registerZeraPilot({approved:true});
  const client=await getClient(result.clientId);
  if(!client||String(client.id)!==String(result.clientId))throw Error('Pilot registration readback mismatch');
  // Registering this authorized pilot creates its persistent audit queue,
  // but intentionally never incurs provider charges or claims completed audits.
  const queries=AUDIT_TASKS.map(t=>t.query);
  const recent=await listScans(100);
  const prior=recent.find(s=>s.clientId===result.clientId
    && ['queued','awaiting-provider'].includes(s.status)
    && JSON.stringify(s.queries)===JSON.stringify(queries));
  const scan=prior||await createScan(result.clientId,queries);
  if(!scan?.id||scan.persisted===false)throw new Error('Audit queue could not be persisted');
  return Response.json({pilotId:result.pilotId,clientId:result.clientId,created:result.created,
    persisted:Boolean(client),status:result.status,role:'customer',adminAccessGranted:false,scanStarted:false,scanQueued:true,scanId:scan.id,queuedQueries:queries.length,
    authorization:{publicAuditOnly:true,websiteChanges:false,socialAccountChanges:false,googleBusinessChanges:false,emailSending:false},nextStep:'Seven authorized public-audit queries queued. Provider execution requires a separately configured, cost-controlled worker; no verified AI answers yet.'});
 }catch(e){
  return Response.json({error:'Pilot could not be persisted'},{status:503,headers:{'Cache-Control':'private, no-store'}});
 }
}

/** Owner-only operational status; never reports synthetic provider scores as verified audits. */
export async function GET(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 const previewIsolated=process.env.VERCEL_ENV==='production'||process.env.ZERA_ISOLATED_PREVIEW_DB==='verified';
 const adminConfigured=Boolean(process.env.ADMIN_PASSWORD&&process.env.AUTH_SECRET);
 const configuredProviders={
  gemini:Boolean(process.env.GEMINI_API_KEY),
  openai:Boolean(process.env.OPENAI_API_KEY||process.env.AI_PROVIDER_API_KEY||process.env.AI_GATEWAY_API_KEY),
  perplexity:Boolean(process.env.PERPLEXITY_API_KEY)
 };
 return Response.json({pilotId:'ZERA-DE-001',role:'customer',publicAuditQueries:AUDIT_TASKS.length,
  safeToRegister:previewIsolated&&adminConfigured,adminConfigured,providerConfigured:Object.values(configuredProviders).some(Boolean),
  evidenceProviderConnected:false,verifiedAuditCount:null,
  autoExecutionReady:false,reportReady:false,
  blockers:[...(!previewIsolated?['preview-database-isolation-unverified']:[]),...(!adminConfigured?['admin-auth-missing']:[]),
   'independent-provider-evidence-worker-not-connected','customer-report-automation-not-connected'],
  note:'Configuration readiness only; no customer record or live scan is asserted.'});
}
