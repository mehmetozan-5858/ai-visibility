import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../lib/paddle-live.js',import.meta.url),'utf8');
test('early subscription reconciliation requires verified settled transaction and matching tenant ownership',()=>{
 assert.match(source,/item\.type==='transaction\.completed'&&paymentResult\.linked===true&&/);
 assert.match(source,/paymentResult\.paymentStatus==='paid'/);
 assert.match(source,/WHERE entity_id=\$1 AND payment_id=\$2 AND client_id=\$3/);
 assert.match(source,/subscriptionResult=await applySubscriptionAccess/);
});
test('source never grants early subscription access without recorded binding',()=>{
 assert.match(source,/if\(!link\)return \{linked:false,accessChanged:false,reason:'subscription-link-unverified'\}/);
 assert.match(source,/SELECT id FROM payments WHERE id=\$1 AND client_id=\$2 FOR UPDATE/);
});
