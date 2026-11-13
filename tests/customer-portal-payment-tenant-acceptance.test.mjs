import test from 'node:test';
import assert from 'node:assert/strict';
import {comparisonReportRows,readCustomerComparisonReport} from '../lib/customer-comparison-report.mjs';
import {readFile} from 'node:fs/promises';
const mine='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const supported={provider:'gemini',status:'source-supported-answer',verified:true,answer:'A documented answer',evidence:{sourceUrl:'https://example.com/source',observation:'Claim supported by a source'}};
test('comparison report isolates tenant and never returns another customer answer',()=>{
 const rows=[
  {clientId:other,query:'Other client secret query',results:[supported],createdAt:'2026-11-11'},
  {clientId:mine,query:'My business query',results:[supported],createdAt:'2026-11-11'}
 ];
 const mineRows=comparisonReportRows(rows,mine);
 assert.equal(mineRows.length,1);
 assert.equal(mineRows[0].query,'My business query');
 assert.equal(mineRows[0].results[0].supported,true);
 assert.equal(mineRows[0].results[0].sourceUrl,'https://example.com/source');
 assert.deepEqual(comparisonReportRows(rows,other).map(r=>r.query),['Other client secret query']);
});
test('unverified model answer never becomes source-supported on customer report',()=>{
 const r=comparisonReportRows([{clientId:mine,query:'Is this verified?',results:[
  {...supported,verified:false},
  {...supported,evidence:{sourceUrl:'http://invalid.example',observation:'Unverified'}},
  {...supported,evidence:{sourceUrl:'https://example.com',observation:''}}
 ]}],mine);
 assert.equal(r.length,1);
 assert.ok(r[0].results.every(x=>x.supported===false&&x.verified===false&&x.evidence===null));
});
test('database query must scope by authenticated tenant; not the request body',async()=>{
 const queries=[];
 const pool={query:async(sql,values)=>{
  queries.push({sql,values});
  if(sql.includes('to_regclass'))return {rows:[{name:'ai_provider_comparisons'}]};
  return {rows:[{clientId:other,query:'Injected other client row',results:[supported]},{clientId:mine,query:'Correct owner',results:[supported]}]};
 }};
 const result=await readCustomerComparisonReport(pool,mine);
 assert.deepEqual(queries[1].values,[mine]);
 assert.match(queries[1].sql,/WHERE client_id=\$1/);
 assert.equal(result.length,1);
 assert.equal(result[0].query,'Correct owner');
 const api=await readFile(new URL('../app/api/client-portal/route.js',import.meta.url),'utf8');
 assert.match(api,/readCustomerComparisonReport\(databasePool\(getDatabaseUrl\(\)\),session.clientId\)/);
 assert.match(api,/if\(!access.allowed\)return privateJson/);
});
