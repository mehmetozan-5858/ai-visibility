import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {prepareCustomerComparisonStorage} from '../lib/customer-comparison-schema.mjs';
const clientId='11111111-1111-4111-8111-111111111111';
test('preflight provisions compatible storage, supports a real JSONB insert, and rejects absent customer',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`CREATE TABLE clients(id UUID PRIMARY KEY);INSERT INTO clients VALUES('${clientId}')`);
  const pool={query:(sql,args)=>db.query(sql,args)};
  await prepareCustomerComparisonStorage(pool,clientId);
  await prepareCustomerComparisonStorage(pool,clientId);
  await db.query('INSERT INTO ai_provider_comparisons(id,client_id,query,results) VALUES($1,$2,$3,$4::jsonb)',[clientId,clientId,'fixture',JSON.stringify([{provider:'gemini',answer:'fixture'}])]);
  assert.equal((await db.query('SELECT results FROM ai_provider_comparisons')).rows[0].results[0].answer,'fixture');
  await assert.rejects(prepareCustomerComparisonStorage(pool,'22222222-2222-4222-8222-222222222222'),/identity unavailable/);
 }finally{await db.close()}
});
test('incompatible existing storage is rejected without silently changing its columns',async()=>{
 const db=new PGlite();
 try{
  await db.exec('CREATE TABLE clients(id UUID PRIMARY KEY);CREATE TABLE ai_provider_comparisons(id UUID,client_id UUID,query TEXT,results TEXT,created_at TIMESTAMPTZ)');
  await assert.rejects(prepareCustomerComparisonStorage({query:(sql,args)=>db.query(sql,args)},clientId),/schema incompatible/);
  assert.equal((await db.query("SELECT data_type FROM information_schema.columns WHERE table_name='ai_provider_comparisons' AND column_name='results'")).rows[0].data_type,'text');
 }finally{await db.close()}
});
test('missing INSERT privilege stops preflight before customer access',async()=>{
 const queries=[];
 const pool={query:async sql=>{
  queries.push(sql);
  if(sql.includes('information_schema'))return {rows:[['id','uuid'],['client_id','uuid'],['query','text'],['results','jsonb'],['created_at','timestamp with time zone']].map(([column_name,data_type])=>({column_name,data_type}))};
  return {rows:sql.includes('has_table_privilege')?[{allowed:false}]:[]};
 }};
 await assert.rejects(prepareCustomerComparisonStorage(pool,clientId),/insert unavailable/);
 assert.equal(queries.some(sql=>sql.startsWith('SELECT id FROM')),false);
});
test('runner retains prior-attempt gate and checks storage before durable claim and provider call',async()=>{
 const source=await readFile(new URL('../app/api/clients/zera-ai-runner/route.js',import.meta.url),'utf8');
 const prior=source.indexOf('if(prior.length)'),preflight=source.indexOf('await prepareCustomerComparisonStorage(pool,client.id)'),claim=source.indexOf('const claim='),call=source.indexOf('await compareCustomerProviders(');
 assert.ok(prior<preflight&&preflight<claim&&claim<call);
 assert.match(source,/no provider calls made/);
});
