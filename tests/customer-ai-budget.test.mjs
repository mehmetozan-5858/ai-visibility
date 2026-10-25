import test from 'node:test';import assert from 'node:assert/strict';
import {assessPilotBudget} from '../lib/customer-ai-budget.mjs';
test('a $1 pilot allowance admits at most ten reserved 10-cent provider calls',()=>{
 assert.equal(assessPilotBudget({reservedCents:90,requests:1}).allowed,true);
 assert.equal(assessPilotBudget({reservedCents:100,requests:1}).allowed,false);
 assert.equal(assessPilotBudget({reservedCents:80,requests:3}).allowed,false);
 assert.equal(assessPilotBudget({requests:3}).requiredCents,30);
 assert.equal(assessPilotBudget({requests:1}).hardCap,false);
});
test('invalid reservation requests are rejected',()=>{
 assert.throws(()=>assessPilotBudget({requests:0}),/Invalid budget/);
 assert.throws(()=>assessPilotBudget({reservedCents:-1}),/Invalid budget/);
});
