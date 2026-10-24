import test from "node:test";
import assert from "node:assert/strict";
import {planCommerceActions as plan} from "../lib/ai-visibility-commerce-action-plan.mjs";
const id="550e8400-e29b-41d4-a716-446655440000";
const product={clientId:id,productId:"sku_1",aiMentions:1,categoryMentions:20,catalogCompletenessPercent:65,inStock:true,secret:"PRIVATE_DATA"};
test("produces high-priority human-review recommendations",()=>{
 const r=plan({authorizedClientId:id,products:[product]});
 assert.equal(r.ok,true);assert.equal(r.summary.actionCount,2);
 assert.deepEqual(r.actions.map(x=>x.action),["review-product-catalog-details","review-ai-discoverability"]);
 assert.equal(r.actions[0].priority,"high");assert.equal(r.externalActionsEnabled,false);
});
test("rejects cross-tenant inputs",()=>{
 const r=plan({authorizedClientId:id,products:[{...product,clientId:"other"}]});
 assert.equal(r.ok,false);assert.equal(r.reason,"cross-tenant-product");
});
test("does not convert no observations into zero visibility",()=>{
 const r=plan({authorizedClientId:id,products:[{...product,aiMentions:0,categoryMentions:0,catalogCompletenessPercent:100}]});
 assert.equal(r.ok,true);assert.equal(r.summary.actionCount,0);
});
test("out of stock products only receive inventory check when catalog complete",()=>{
 const r=plan({authorizedClientId:id,products:[{...product,inStock:false,catalogCompletenessPercent:100}]});
 assert.deepEqual(r.actions.map(x=>x.action),["check-stock-before-promotion"]);
 assert.equal(r.actions[0].priority,"review");
});
test("never emits source secrets or raw product fields",()=>{
 const r=plan({authorizedClientId:id,products:[product]});
 assert.equal(JSON.stringify(r).includes("PRIVATE_DATA"),false);
 assert.equal(Object.hasOwn(r.actions[0],"secret"),false);
});
