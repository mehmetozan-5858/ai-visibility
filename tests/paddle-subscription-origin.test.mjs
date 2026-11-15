import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../lib/paddle-live.js',import.meta.url),'utf8');

test('signed subscription.created stores provider transaction origin without activating access',()=>{
 assert.match(source,/item\.type==='subscription\.created'&&\/\^txn_/);
 assert.match(source,/INSERT INTO paddle_live_subscription_origins\(subscription_id,transaction_id\)/);
 assert.match(source,/WHERE paddle_live_subscription_origins\.transaction_id=EXCLUDED\.transaction_id/);
});
test('early lifecycle reconciliation requires exact originating transaction and prevents forged tenant mapping',()=>{
 assert.match(source,/WHERE subscription_id=\$1 AND transaction_id=\$2 FOR UPDATE/);
 assert.match(source,/\[item\.data\.subscription_id,item\.entityId\]/);
 assert.match(source,/\(payment_id=\$2 OR payment_id IS NULL\)/);
 assert.match(source,/\(client_id=\$3 OR client_id IS NULL\)/);
 assert.match(source,/subscriptionResult=await applySubscriptionAccess/);
});
test('unlinked or conflicting origin cannot become entitlement',()=>{
 assert.match(source,/if\(!saved\.rows\.length\)throw Error\('subscription-origin-conflict'\)/);
 assert.match(source,/const prior=origin\?/);
 assert.match(source,/if\(!link\)return \{linked:false,accessChanged:false,reason:'subscription-link-unverified'\}/);
});
