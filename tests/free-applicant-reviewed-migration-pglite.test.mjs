import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {persistVerifiedFreeApplicantPair} from '../lib/free-applicant-atomic-store.mjs';
import {readVerifiedFreeApplicantAssessment} from '../lib/free-applicant-verified-db-read.mjs';

const scope={tenantId:'550e8400-e29b-41d4-a716-446655440000',domain:'example.test'};
const entity={id:scope.tenantId,domain:scope.domain};
const poolFor=db=>({query:(...args)=>db.query(...args),connect:async()=>({query:(...args)=>db.query(...args),release(){}})});

function sample(i=0,provider='OpenRouter',tenant=scope.tenantId){
 const now=new Date(Date.now()-10000).toISOString();
 const query='Neutral buyer discovery question '+i+'?';
 const responseId='provider-response-'+provider+'-'+i;
 const observation={tenantId:tenant,domain:scope.domain,provider,
   model:'synthetic-model',responseId,query,text:'Offline neutral answer',
   brandMentioned:i===0,brandPrompted:false,truncated:false,mode:'api-no-search',recordedAt:now};
 const receipt={id:provider+'-receipt-'+i,tenantId:tenant,domain:scope.domain,
   provider,model:'synthetic-model',responseId,query,amount:0,currency:'USD',
   estimated:false,operation:'answer-evidence',verifiedZeroPriceAtRequest:true,
   persisted:true,responseComplete:true,verifiedModelIdentity:true};
 return {observation,receipt};
}

test('review-only migration creates real scoped tables and rejects duplicate provider proof',async()=>{
 const db=new PGlite();
 try{
  const sql=await readFile(new URL('../migrations/free-applicant-verified-proof-review.sql',import.meta.url),'utf8');
  await db.exec(sql);
  const pool=poolFor(db);
  const first=sample(0);
  assert.equal((await persistVerifiedFreeApplicantPair({pool,...first,scope})).stored,true);
  const repeated=sample(0);
  repeated.receipt.id='alternate-receipt';
  assert.equal((await persistVerifiedFreeApplicantPair({pool,...repeated,scope})).stored,false);
  const count=await db.query('SELECT count(*)::int AS n FROM public.free_applicant_verified_receipts');
  assert.equal(count.rows[0].n,1);
  const foreign=await readVerifiedFreeApplicantAssessment(pool,
    {id:'123e4567-e89b-42d3-a456-426614174000',domain:scope.domain});
  assert.equal(foreign.status,'insufficient');
  assert.equal(foreign.score,null);
  const measured=await readVerifiedFreeApplicantAssessment(pool,entity);
  assert.equal(measured.status,'insufficient');
  assert.equal(measured.samples,1);
  assert.equal(measured.score,null);
 }finally{await db.close();}
});

test('review schema rejects malformed zero-price claims at storage layer',async()=>{
 const db=new PGlite();
 try{
  const sql=await readFile(new URL('../migrations/free-applicant-verified-proof-review.sql',import.meta.url),'utf8');
  await db.exec(sql);
  const sampleInput=sample(1);
  await assert.rejects(db.query(`INSERT INTO public.free_applicant_verified_receipts
   (id,tenant_id,domain,provider,model,response_id,query_text,amount,currency,
    estimated,operation,verified_zero_price,response_complete,verified_model_identity)
   VALUES ($1,$2,$3,$4,$5,$6,$7,0.01,'USD',false,'answer-evidence',true,true,true)`,
   [sampleInput.receipt.id,scope.tenantId,scope.domain,'OpenRouter','synthetic-model',
    sampleInput.receipt.responseId,sampleInput.receipt.query]));
 }finally{await db.close();}
});
