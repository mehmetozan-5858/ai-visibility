import {requireAdmin} from '../../../../lib/api-security';
import {zeraRegistrationGate} from '../../../../pilot/zera-registration-gate.mjs';
import {buildAuditQueue} from '../../../../pilot/zera-audit-queue.mjs';
/** Read-only pilot check. Never invokes Google or charges a provider. */
export async function GET(req){
 const denied=await requireAdmin(req);if(denied)return denied;
 const gate=zeraRegistrationGate(process.env);
 const query=buildAuditQueue().find(t=>t.id==='brand-ai-de');
 return Response.json({
  isolatedPreview:gate.allowed,
  geminiConfigured:Boolean(process.env.GEMINI_API_KEY),
  billingVerified:process.env.ZERA_PROVIDER_BILLING_CAP_VERIFIED==='true',
  plannedQuery:query?.query||null,
  liveScanExecuted:false,
  nextStep:'Verify quota and API eligibility before a separately authorized single request'
 },{headers:{'Cache-Control':'private, no-store'}});
}
