import test from 'node:test';
import assert from 'node:assert/strict';
import {workBlocker,sortWorkBlockers} from '../lib/work-blockers.js';
test('blockers use recorded requirements and put oldest waiting work first',()=>{
 const items=[{id:1,status:'ready',updatedAt:'2026-10-01'},{id:2,status:'access-required',updatedAt:'2026-10-06',detail:'WordPress edit access'},{id:3,status:'approval-required',updatedAt:'2026-10-04'}];
 assert.deepEqual(sortWorkBlockers(items).map(x=>x.id),[3,2,1]);
 assert.equal(workBlocker(items[1],Date.parse('2026-10-07')).required,'WordPress edit access');
 assert.equal(workBlocker(items[1],Date.parse('2026-10-07')).days,1);
 assert.equal(workBlocker({status:'access-required',updatedAt:'invalid'}).days,null);
 assert.equal(workBlocker(items[1],Date.parse('2026-10-01')).days,0);
});
