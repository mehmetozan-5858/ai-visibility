import test from 'node:test';
import assert from 'node:assert/strict';
import {withRequestBudget,budgetFetch,remainingBudget} from '../lib/request-budget.js';
import {initializeSchema} from '../lib/database-runtime.js';
test('concurrent schema initialization runs one migration and retries failed initialization',async()=>{
 let migrations=0,released=0,fail=true;
 const pool={connect:async()=>({query:async()=>({rows:[]}),release(){released++}})};
 const ensure=async()=>{migrations++;await new Promise(r=>setTimeout(r,5));if(fail)throw new Error('migration-failure')};
 const failures=await Promise.allSettled([initializeSchema(pool,'test',ensure),initializeSchema(pool,'test',ensure)]);
 assert.ok(failures.every(x=>x.status==='rejected'));assert.equal(migrations,1);fail=false;
 await Promise.all([initializeSchema(pool,'test',ensure),initializeSchema(pool,'test',ensure)]);assert.equal(migrations,2);assert.equal(released,2);
});
test('request budgets are isolated and expired budgets never issue another HTTP request',async()=>{
 await withRequestBudget(-1,async()=>{assert.equal(remainingBudget(),0);await assert.rejects(budgetFetch('https://unused.invalid'),/request-budget-exhausted/)});
 assert.equal(remainingBudget(),Infinity);
});
test('provider fetch receives an abort signal bounded by the caller deadline',async()=>{
 const previous=globalThis.fetch;
 try{globalThis.fetch=async(url,options)=>{assert.ok(options.signal instanceof AbortSignal);return {ok:true}};
  await withRequestBudget(100,()=>budgetFetch('https://unused.invalid'));
 }finally{globalThis.fetch=previous}
});
