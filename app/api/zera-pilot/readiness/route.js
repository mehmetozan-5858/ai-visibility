import {assessZeraProviderSpendGate} from '../../../../lib/zera-provider-spend-gate.mjs';
import {buildAuditQueue} from '../../../../pilot/zera-audit-queue.mjs';
import {createPilot} from '../../../../pilot/zera-pilot.mjs';
import {requireAdmin} from '../../../../lib/api-security';
// Read-only operational checklist. Does not open DB connections or invoke AI providers.
export async function GET(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 const pilot=createPilot();
 const preview=process.env.VERCEL_ENV==='preview';
 const production=process.env.VERCEL_ENV==='production';
 const databaseConfigured=Boolean(process.env.DATABASE_URL||process.env.STORAGE_URL);
 const isolationConfirmed=preview && process.env.ZERA_ISOLATED_PREVIEW_DB==='verified';
 const providerConfigured=Boolean(process.env.GEMINI_API_KEY||process.env.PERPLEXITY_API_KEY||process.env.OPENAI_API_KEY||process.env.AI_PROVIDER_API_KEY);
 const spendGate=assessZeraProviderSpendGate(process.env);
 const blockers=[
  !spendGate.allowed?'provider-spend-hold':null,
  !databaseConfigured?'database-not-configured':null,
  !isolationConfirmed?'database-isolation-not-confirmed':null,
  !providerConfigured?'provider-not-configured':null,
 ].filter(Boolean);
 return Response.json({
  pilotId:pilot.id,environment:production?'production':preview?'preview':'other',
  prerequisites:{databaseConfigured,isolationConfirmed,providerConfigured},
  readyForLiveRun:blockers.length===0,blockers,
  // This is only the configured task *plan*, never actual audit completion.
  plannedTasks:buildAuditQueue(pilot).map(({id,channel,locale,query})=>({id,channel,locale,query})),
  liveAuditStatus:'not-queried',
  note:'Read-only configuration inspection; does not prove provider availability or DB isolation and does not launch a scan.'
 },{headers:{'cache-control':'no-store'}});
}
