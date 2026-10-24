/**
 * Offline, deterministic Commerce Intelligence opportunity signals.
 * Not a revenue prediction. Inputs are pre-aggregated first-party observations;
 * the caller must verify client identity and entitlement before invoking.
 * No remote requests, DB writes, personal data, or autonomous changes.
 */
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const safe=n=>Number.isSafeInteger(n)&&n>=0;
const pct=n=>Number.isInteger(n)&&n>=0&&n<=100;
export function analyzeCommerceOpportunities({authorizedClientId,products}={}){
 if(typeof authorizedClientId!=="string"||!uuid.test(authorizedClientId))return {ok:false,reason:"invalid-client"};
 if(!Array.isArray(products)||products.length>100)return {ok:false,reason:"invalid-products"};
 const seen=new Set(),result=[];
 for(const p of products){
  if(!p||p.clientId!==authorizedClientId)return {ok:false,reason:"cross-tenant-product"};
  if(typeof p.productId!=="string"||!/^[a-zA-Z0-9_-]{1,64}$/.test(p.productId)||seen.has(p.productId))return {ok:false,reason:"invalid-or-duplicate-product"};
  if(!safe(p.aiMentions)||!safe(p.categoryMentions)||p.aiMentions>p.categoryMentions||!pct(p.catalogCompletenessPercent)||typeof p.inStock!=="boolean")return {ok:false,reason:"invalid-product-metrics"};
  seen.add(p.productId);
  // An opportunity is a diagnostic rule, never a claim about future sales.
  const visibilityPercent=p.categoryMentions===0?null:Math.round(p.aiMentions/p.categoryMentions*10000)/100;
  const flags=[];
  if(p.catalogCompletenessPercent<80)flags.push("catalog-detail-gap");
  if(p.inStock&&p.categoryMentions>=10&&visibilityPercent<20)flags.push("low-observed-ai-visibility");
  if(!p.inStock)flags.push("out-of-stock");
  const priority=flags.includes("catalog-detail-gap")&&p.inStock?"high":flags.includes("low-observed-ai-visibility")?"medium":flags.length?"review":"none";
  result.push({productId:p.productId,visibilityPercent,catalogCompletenessPercent:p.catalogCompletenessPercent,inStock:p.inStock,flags,priority});
 }
 return {ok:true,clientId:authorizedClientId,serviceId:"agent-commerce-intelligence",summary:{productsReviewed:result.length,productsFlagged:result.filter(p=>p.flags.length).length},products:result,externalActionsEnabled:false};
}
