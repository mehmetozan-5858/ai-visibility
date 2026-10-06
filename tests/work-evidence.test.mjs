import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const source=(await fs.readFile(new URL('../lib/work-evidence.js',import.meta.url),'utf8')).replace(/^import .*;$/gm,'').replace(/export /g,'');
const {completionEvidence,updateWorkWithEvidence}=new Function('crypto','initializeSchema',source+';return {completionEvidence,updateWorkWithEvidence}')(crypto,async()=>{});
const evidence={detail:'Published FAQ and checked the visible page content.',url:'https://example.com/faq',confirmed:true};
function fixture({status='in-progress',eligible=true,failAudit=false}={}){
 let work={id:'work',client_id:'client',status,title:'FAQ',completion_evidence:''},snapshot;const calls=[];
 const tx={release(){calls.push('release')},async query(sql,a){calls.push(sql);if(sql==='BEGIN')snapshot={...work};if(sql==='ROLLBACK')work=snapshot;if(sql.startsWith('SELECT * FROM work_items'))return {rows:[{...work}]};if(sql.startsWith('SELECT c.id')){assert.match(sql,/c.status='active'/);assert.match(sql,/terms_version/);return {rows:eligible?[{id:'client'}]:[]}}if(sql.startsWith('UPDATE work_items')){work={...work,status:a[1],completion_evidence:a[2],evidence_url:a[3]};return {rows:[{...work}]}}if(sql.startsWith('INSERT INTO client_activity')){if(failAudit)throw Error('audit-failed');const metadata=JSON.parse(a[3]);assert.equal(metadata.verification,'admin-attested')}return {rows:[]}}};
 return {pool:{connect:async()=>tx},calls,get work(){return work}};
}
test('completion requires detailed confirmed evidence and rejects unsafe links',()=>{assert.deepEqual(completionEvidence(evidence),{detail:evidence.detail,url:evidence.url});for(const x of [{...evidence,confirmed:false},{...evidence,detail:'done'},{...evidence,url:'javascript:alert(1)'},{...evidence,url:'https://user:secret@example.com/'}])assert.throws(()=>completionEvidence(x))});
test('completion and evidence audit commit together',async()=>{const f=fixture();await updateWorkWithEvidence(f.pool,'work','completed',evidence,'in-progress');assert.equal(f.work.status,'completed');assert.equal(f.work.completion_evidence,evidence.detail);assert.ok(f.calls.includes('COMMIT'));assert.equal(f.calls.at(-1),'release')});
test('audit failure rolls back work completion',async()=>{const f=fixture({failAudit:true});await assert.rejects(updateWorkWithEvidence(f.pool,'work','completed',evidence,'in-progress'),/audit-failed/);assert.equal(f.work.status,'in-progress');assert.ok(f.calls.includes('ROLLBACK'));assert.ok(!f.calls.includes('COMMIT'))});
test('stale screens, unpaid customers, and unstarted work cannot complete',async()=>{for(const [options,expected,message] of [[{},'ready','work-changed'],[{eligible:false},'in-progress','paid-real-client-required'],[{status:'approval-required'},'approval-required','work-not-in-progress']]){const f=fixture(options);await assert.rejects(updateWorkWithEvidence(f.pool,'work','completed',evidence,expected),new RegExp(message));assert.ok(!f.calls.some(x=>x.startsWith('UPDATE work_items')))}});
test('repeat completion does not rewrite evidence or add another audit',async()=>{const f=fixture({status:'completed'});assert.equal((await updateWorkWithEvidence(f.pool,'work','completed',evidence,'completed')).unchanged,true);assert.ok(!f.calls.some(x=>x.startsWith('UPDATE')||x.startsWith('INSERT')))});
