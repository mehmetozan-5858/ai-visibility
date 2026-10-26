import test from 'node:test';
import assert from 'node:assert/strict';
import {buildZeraPilotDraft} from '../lib/zera-pilot-draft.mjs';
test('unverified stored answers and review candidates cannot produce a customer-ready report',()=>{
 const draft=buildZeraPilotDraft({attempts:[{taskId:'brand-ai-de',status:'stored'},{taskId:'brand-ai-tr',status:'provider-failed'}],googleCandidates:[{taskId:'brand-google-de',candidates:2}],ownedSiteCount:1});
 assert.equal(draft.totalTasks,7);
 assert.equal(draft.verifiedTasks,0);
 assert.equal(draft.visibilityScore,null);
 assert.equal(draft.readyForCustomer,false);
 assert.equal(draft.tasks.find(t=>t.id==='brand-ai-de').status,'stored-unverified');
 assert.equal(draft.tasks.find(t=>t.id==='brand-ai-tr').status,'blocked');
 assert.equal(draft.tasks.find(t=>t.id==='brand-google-de').pendingReviewCandidates,2);
 assert.equal(draft.ownedSiteObservations,1);
});
test('empty status produces seven pending tasks without manufacturing a report score',()=>{
 const draft=buildZeraPilotDraft();
 assert.equal(draft.tasks.filter(t=>t.status==='pending').length,7);
 assert.equal(draft.verifiedTasks,0);
 assert.equal(draft.readyForCustomer,false);
});
