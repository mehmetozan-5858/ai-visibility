import {analyzeCommerceOpportunities} from "./ai-visibility-commerce-opportunities.mjs";
/**
 * Deterministic, non-executing Commerce Intelligence action plan.
 * Recompute signals from trusted tenant-scoped aggregate inputs instead of
 * accepting user-supplied flags. No legal/compliance advice or external action.
 */
const ACTIONS={
 "catalog-detail-gap":{action:"review-product-catalog-details",rationale:"Catalog completeness is below 80%"},
 "low-observed-ai-visibility":{action:"review-ai-discoverability",rationale:"Observed mentions are below 20% of the measured category sample"},
 "out-of-stock":{action:"check-stock-before-promotion",rationale:"Product is reported out of stock"}
};
export function planCommerceActions({authorizedClientId,products}={}){
 const analysis=analyzeCommerceOpportunities({authorizedClientId,products});
 if(!analysis.ok)return analysis;
 const actions=[];
 for(const product of analysis.products){
  for(const flag of product.flags){
   const rule=ACTIONS[flag];
   if(!rule)return {ok:false,reason:"unknown-signal"};
   actions.push({productId:product.productId,priority:flag==="out-of-stock"?"review":product.priority,signal:flag,action:rule.action,rationale:rule.rationale});
  }
 }
 const rank={high:0,medium:1,review:2,none:3};
 actions.sort((a,b)=>rank[a.priority]-rank[b.priority]||a.productId.localeCompare(b.productId)||a.action.localeCompare(b.action));
 return {ok:true,clientId:analysis.clientId,serviceId:analysis.serviceId,summary:{productsReviewed:analysis.summary.productsReviewed,actionCount:actions.length},actions,externalActionsEnabled:false};
}
