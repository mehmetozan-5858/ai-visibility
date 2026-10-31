import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {PDFDocument} from 'pdf-lib';
import {comparisonReportRows,readCustomerComparisonReport} from '../lib/customer-comparison-report.mjs';
import {buildReportResponse} from '../lib/report-pdf.js';
const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const result={provider:'gemini',status:'source-supported-answer',verified:true,answer:'AI yanıtı',evidence:{sourceUrl:'https://example.org/source',observation:'Kaynak bölümü'}};
const row={clientId:id,query:'Test sorgusu',results:[result],createdAt:'2026-10-31T12:00:00Z'};
test('report only accepts the authenticated customer and supported response types',()=>{
 const normalized=comparisonReportRows([row,{...row,clientId:other},{...row,results:[{provider:'gemini',status:'failed',answer:'error'}]}],id);
 assert.equal(normalized.length,1);assert.equal(normalized[0].results[0].supported,true);
 assert.equal(normalized[0].results[0].sourceUrl,'https://example.org/source');
 assert.deepEqual(comparisonReportRows([row],''),[]);
 assert.deepEqual(comparisonReportRows(normalized,id),normalized);
});
test('missing evidence, unsafe sources or unverified claims cannot become source-supported',()=>{
 for(const change of [{verified:false},{status:'answer-received-unverified'},{evidence:null},{evidence:{sourceUrl:'javascript:alert(1)',observation:'x'}},{evidence:{sourceUrl:'https://secret:password@example.org',observation:'x'}},{evidence:{sourceUrl:'https://example.org',observation:''}}]){
  const r=comparisonReportRows([{...row,results:[{...result,...change}]}],id)[0].results[0];
  assert.equal(r.supported,false);assert.equal(r.sourceUrl,null);assert.equal(r.observation,null);
 }
});
test('database reader uses customer-bound SELECT without provisioning a missing table',async()=>{
 const db=new PGlite();const calls=[];const pool={query:(sql,args)=>{calls.push(sql);return db.query(sql,args)}};
 try{
  assert.deepEqual(await readCustomerComparisonReport(pool,id),[]);
  assert.equal(calls.length,1);
  await db.exec('CREATE TABLE ai_provider_comparisons(client_id UUID,query TEXT,results JSONB,created_at TIMESTAMPTZ)');
  for(const client of [id,other])await db.query('INSERT INTO ai_provider_comparisons VALUES($1,$2,$3::jsonb,NOW())',[client,'fixture',JSON.stringify([result])]);
  const rows=await readCustomerComparisonReport(pool,id);assert.equal(rows.length,1);assert.equal(rows[0].clientId,id);
  assert.ok(calls.every(sql=>sql.startsWith('SELECT')));
 }finally{await db.close()}
});
test('evidence-only pilot renders a valid PDF without requiring or inventing a scored scan',async()=>{
 const response=await buildReportResponse({clientId:id,clients:[{id,name:'ZERA TEST'}],allScans:[],comparisons:[row],pilot:true});
 assert.equal(response.headers.get('content-type'),'application/pdf');
 const pdf=await PDFDocument.load(await response.arrayBuffer());assert.ok(pdf.getPageCount()>=1);
});
