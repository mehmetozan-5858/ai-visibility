import {test} from 'node:test';
import assert from 'node:assert/strict';
import {orderGuideAllowed} from '../lib/order-guide-access.mjs';
test('explicit single pilot allowlist defaults closed',()=>{const env={ORDER_GUIDE_PREVIEW_ENABLED:'true',ORDER_GUIDE_PREVIEW_CLIENT_ID:'pilot-a'};assert.equal(orderGuideAllowed('pilot-a',env),true);for(const id of ['pilot-b','',undefined])assert.equal(orderGuideAllowed(id,env),false);assert.equal(orderGuideAllowed('pilot-a',{}),false);assert.equal(orderGuideAllowed('pilot-a',{...env,ORDER_GUIDE_PREVIEW_ENABLED:'false'}),false);});
