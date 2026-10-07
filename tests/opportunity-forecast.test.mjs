import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../lib/prospects.js',import.meta.url),'utf8');
const fn=source.slice(source.indexOf('export async function refreshOpportunityForecasts'),source.indexOf('export async function listOpportunityForecasts'));
const refresh=new Function('db','recordDecisionAuditBatch',fn.replace('export async function','return async function'));
test('1000 forecasts use one bulk update and preserve every decision audit',async()=>{
 const rows=Array.from({length:1000},(_,i)=>({id:String(i),name:`Company ${i}`,qualification_score:80,score:40,proposal_amount:1000,proposal_currency:'USD',contact_status:'verified'}));
 const queries=[],audits=[];
 const run=refresh(async callback=>callback({query:async(sql,args)=>{queries.push({sql,args});return {rows:sql.startsWith('SELECT')?rows:[]}}}),async items=>audits.push(...items));
 const result=await run(1000);
 assert.equal(queries.length,2);assert.equal(result.length,1000);assert.equal(audits.length,1000);
 const written=JSON.parse(queries[1].args[0]);assert.equal(written.length,1000);
 assert.equal(result[0].probability,38);assert.equal(result[0].expectedValue,380);
 assert.equal(audits[999].entityId,'999');assert.equal(audits[0].decision.probability,38);
});
test('empty pools do not write and failed bulk persistence is not reported as success',async()=>{
 let writes=0;
 const empty=refresh(async cb=>cb({query:async()=>({rows:[]})}),async()=>{writes++});
 assert.deepEqual(await empty(),[]);assert.equal(writes,0);
 const failing=refresh(async cb=>cb({query:async sql=>{if(sql.startsWith('UPDATE'))throw new Error('database-write-failed');return {rows:[{id:'1'}]}}}),async()=>{writes++});
 await assert.rejects(failing(),/database-write-failed/);assert.equal(writes,0);
});
