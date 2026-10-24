/**
 * ZERA pilot domain model. No network calls, private account access or email sending.
 * Persistence/integrations require separate explicit configuration and consent.
 */
export const PILOT_ID = 'ZERA-DE-001';
export const SCOPES = Object.freeze(['public_brand_audit', 'public_competitor_audit', 'public_ai_search_audit']);
export const BASELINE = Object.freeze({
  asOf:'2026-10-24', instagramFollowers:3575, instagramPosts:142,
  provenance:'user-provided Instagram screenshots; not independently live-verified'
});
export function createPilot() {
  return {id:PILOT_ID, brand:'ZERA Clothing', country:'DE', city:'Wetzlar',
    instagram:'zeraclothing.official', website:null, email:'info@ze-ra.de',
    consent:{status:'written_public_scope_confirmed', receivedAt:'2026-10-24',
      authorizedScopes:[...SCOPES], proof:'owner-held reply email; do not replicate personal email contents in public repository'},
    baseline:{...BASELINE}, stage:'public_audit', outboundEnabled:false,
    paidServicesEnabled:false, accessToPrivateData:false};
}
export function canRun(pilot, scope) {
 return pilot?.consent?.status==='written_public_scope_confirmed'
 && pilot?.consent?.authorizedScopes?.includes(scope)===true;
}
export function assertPublicScope(pilot,scope) {
 if(!canRun(pilot,scope)) throw new Error('Consent or authorized public scope missing');
}
export function classifyEvidence({type,sourceUrl,observedAt,query,observation}){
 if(!['observed','hypothesis','unverified'].includes(type)) throw new Error('Invalid evidence type');
 if(type==='observed'&&(!sourceUrl||!observedAt||!observation)) throw new Error('Observed findings require source, date and observation');
 return {type,sourceUrl:sourceUrl??null,observedAt:observedAt??null,query:query??null,observation:observation??null};
}
export function campaignLink(baseUrl,{source,medium='organic',campaign='zera-pilot-001'}){
 const url=new URL(baseUrl);
 if(!['https:'].includes(url.protocol)) throw new Error('HTTPS required');
 for(const [key,value] of Object.entries({utm_source:source,utm_medium:medium,utm_campaign:campaign})){
  if(!value||typeof value!=='string') throw new Error('Campaign parameter missing');
  url.searchParams.set(key,value);
 }
 return url.toString();
}
export function summarizeFunnel({visits=0,leads=0,verifiedOrders=[],currency='EUR'}){
 if(![visits,leads].every(n=>Number.isInteger(n)&&n>=0)) throw new Error('Invalid counts');
 if(!Array.isArray(verifiedOrders)) throw new Error('Invalid order array');
 const ids=new Set();let revenue=0;
 for(const order of verifiedOrders){
   if(!order?.merchantVerified || !order?.consentedAttribution) throw new Error('Sale not verified/attributed');
   if(typeof order.id!=='string'||ids.has(order.id)) throw new Error('Missing or duplicate order ID');
   if(!Number.isFinite(order.amount)||order.amount<0) throw new Error('Invalid order amount');
   ids.add(order.id);revenue+=order.amount;
 }
 return {visits,leads,verifiedSales:ids.size,verifiedRevenue:Number(revenue.toFixed(2)),currency,
   leadRate:visits?Number((100*leads/visits).toFixed(2)):null,
   salesPerLead:leads?Number((100*ids.size/leads).toFixed(2)):null,
   caveat:'Campaign attribution is not proof of incremental causal uplift.'};
}
export function enqueueOutreach({draft,approvedBy,senderConfigured,consentToContact}){
 if(!draft?.recipient||!draft?.subject||!draft?.body) throw new Error('Draft incomplete');
 if(!approvedBy||!senderConfigured||!consentToContact) return {status:'awaiting_approval',sent:false};
 return {status:'ready_for_send',sent:false}; // never dispatch implicitly
}
