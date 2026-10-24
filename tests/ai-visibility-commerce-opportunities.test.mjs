import test from "node:test";
import assert from "node:assert/strict";
import {analyzeCommerceOpportunities as analyze} from "../lib/ai-visibility-commerce-opportunities.mjs";
const id="550e8400-e29b-41d4-a716-446655440000";
const product={clientId:id,productId:"sku_1",aiMentions:1,categoryMentions:20,catalogCompletenessPercent:65,inStock:true,secret:"DO_NOT_SHARE"};
test("finds evidence-based visibility and catalog gaps",()=>{
 const r=analyze({authorizedClientId:id,products:[product]});
 assert.equal(r.ok,true);assert.equal(r.products[0].visibilityPercent,5);
 assert.deepEqual(r.products[0].flags,["catalog-detail-gap","low-observed-ai-visibility"]);
 assert.equal(r.products[0].priority,"high");assert.equal(r.summary.productsFlagged,1);
});
test("no observations means unknown visibility, not zero",()=>{
 const r=analyze({authorizedClientId:id,products:[{...product,aiMentions:0,categoryMentions:0,catalogCompletenessPercent:100}]});
 assert.equal(r.products[0].visibilityPercent,null);
 assert.deepEqual(r.products[0].flags,[]);
});
test("rejects other tenant and duplicate products",()=>{
 assert.equal(analyze({authorizedClientId:id,products:[{...product,clientId:"other"}]}).reason,"cross-tenant-product");
 assert.equal(analyze({authorizedClientId:id,products:[product,product]}).reason,"invalid-or-duplicate-product");
});
test("rejects inconsistent or malformed counters",()=>{
 assert.equal(analyze({authorizedClientId:id,products:[{...product,aiMentions:21}]}).ok,false);
 assert.equal(analyze({authorizedClientId:id,products:[{...product,catalogCompletenessPercent:101}]}).ok,false);
 assert.equal(analyze({authorizedClientId:id,products:[{...product,productId:"<script>"}]}).ok,false);
});
test("only allowlisted fields appear in output",()=>{
 const r=analyze({authorizedClientId:id,products:[product]});
 assert.equal(JSON.stringify(r).includes("DO_NOT_SHARE"),false);
 assert.equal(r.externalActionsEnabled,false);
});
test("out-of-stock items are flagged but not prioritized for optimization",()=>{
 const r=analyze({authorizedClientId:id,products:[{...product,inStock:false,catalogCompletenessPercent:100}]});
 assert.deepEqual(r.products[0].flags,["out-of-stock"]);
 assert.equal(r.products[0].priority,"review");
});
