import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PGlite} from '@electric-sql/pglite';
import {prepareCustomerComparisonStorage,storeSingleScanComparison} from '../lib/customer-comparison-storage.mjs';

const customer='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const comparison=(clientId=customer)=>({clientId,query:'Synthetic one-shot query',results:[{provider:'gemini',status:'answer-received-unverified',verified:false,answer:'Fixture only.'}]});
let db,dir,pool;
before(async()=>{
 dir=await mkdtemp(join(tmpdir(),'single-comparison-'));db=new PGlite(dir);
 pool={query:(sql,args)=>db.query(sql,args),connect:async()=>({query:(sql,args)=>db.query(sql,args),release(){}})};
 await db.exec('CREATE TABLE clients(id UUID PRIMARY KEY);CREATE TABLE zera_production_scan_attempts(id TEXT PRIMARY KEY,client_id UUID,status TEXT,comparison_id UUID);');
 await db.query('INSERT INTO clients VALUES($1),($2)',[customer,other]);
 await prepareCustomerComparisonStorage({pool,clientId:customer});
 await db.query("INSERT INTO zera_production_scan_attempts VALUES('first-free-gemini',$1,'started',NULL)",[customer]);
});
after(async()=>{await db.close();await rm(dir,{recursive:true,force:true})});

test('one-shot recorder rejects a different customer and mismatched answer identity',async()=>{
 await assert.rejects(storeSingleScanComparison({pool,clientId:other,comparison:comparison(other)}),/Owned started/);
 await assert.rejects(storeSingleScanComparison({pool,clientId:customer,comparison:comparison(other)}),/identity mismatch/);
 assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM ai_provider_comparisons')).rows[0].n,0);
});
test('one-shot completion failure rolls back the answer and keeps the original claim',async()=>{
 const failing={connect:async()=>({query:async(sql,args)=>{
  if(sql.startsWith('UPDATE zera_production_scan_attempts'))throw Error('fixture update failure');
  return db.query(sql,args);
 },release(){}})};
 await assert.rejects(storeSingleScanComparison({pool:failing,clientId:customer,comparison:comparison()}),/fixture update failure/);
 assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM ai_provider_comparisons')).rows[0].n,0);
 assert.equal((await db.query('SELECT status FROM zera_production_scan_attempts')).rows[0].status,'started');
});
test('legacy stored claim without answer ID cannot generate another comparison',async()=>{
 await db.exec("UPDATE zera_production_scan_attempts SET status='stored'");
 try{await assert.rejects(storeSingleScanComparison({pool,clientId:customer,comparison:comparison()}),/Owned started/)}
 finally{await db.exec("UPDATE zera_production_scan_attempts SET status='started'")}
 assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM ai_provider_comparisons')).rows[0].n,0);
});
test('one-shot answer and completion persist together; restart replay returns original ID',async()=>{
 const saved=await storeSingleScanComparison({pool,clientId:customer,comparison:comparison()});
 const claim=(await db.query('SELECT status,comparison_id FROM zera_production_scan_attempts')).rows[0];
 assert.equal(claim.status,'stored');assert.equal(claim.comparison_id,saved.id);
 assert.equal(saved.visibilityScore,null);
 await db.close();db=new PGlite(dir);
 const replay=await storeSingleScanComparison({pool,clientId:customer,comparison:comparison()});
 assert.equal(replay.id,saved.id);assert.equal(replay.duplicate,true);
 assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM ai_provider_comparisons')).rows[0].n,1);
});
