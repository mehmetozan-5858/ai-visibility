import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectOfficialHtml,inspectProspectWebsite} from '../lib/website-inspection.js';
import {prospectEvidence,websiteEvidence} from '../lib/prospect-evidence.js';
import {evaluateOutreachPool} from '../lib/outreach-selection.js';
import {permissionEnquiry,safeFirstContact} from '../lib/outreach-quality.js';
const date='2026-10-07T09:00:00Z',url='https://company.com/';
const html=head=>`<!doctype html><html><head>${head}</head><body>Business</body></html>`;
test('only downloaded page title and description checks carry source, time and narrow scope',()=>{
 const evidence=inspectOfficialHtml({url,html:html('<title>Company</title><meta content="A company description" name="description">')},date);
 const x=prospectEvidence({domain:'company.com',scanEvidence:evidence,scanScore:25,scanProvider:'ChatGPT',scanFindings:['Google profile var mı bilinmiyor.','NAP tutarlılığı doğrulanmıyor.','Missing service schema markup'],scanRecommendations:['Create or verify a Google profile.']});
 assert.equal(x.verifiedObservations.length,2);assert.equal(x.verifiedIssues.length,0);assert.equal(x.pendingChecks.length,3);assert.equal(x.page.sourceUrl,url);assert.equal(x.page.checkedAt,date);assert.match(x.page.scope,/diğer sayfalar/);assert.equal(x.scoreKind,'provider-estimate');
});
test('missing tags are reported only on inspected HTML; script and comment text do not fabricate presence',()=>{
 const evidence=inspectOfficialHtml({url,html:html('<!-- <title>Fake</title> --><script>"<meta name=\"description\" content=\"Fake\">"</script>')},date);
 const page=websiteEvidence(evidence,'company.com');assert.equal(page.issues.length,2);assert.ok(page.issues.every(c=>c.text.includes('Alınan HTML sayfasında')));assert.ok(page.issues.every(c=>c.sourceUrl===url));
});
test('challenge pages, non-HTML and failed official downloads never imply a missing tag',async()=>{
 for(const value of ['not HTML',html('<title>Just a moment</title>'),html('<title>Verify you are human</title>')])assert.throws(()=>inspectOfficialHtml({url,html:value}));
 const record=await inspectProspectWebsite({domain:'company.com'},{read:async()=>{throw Error('timeout')}});assert.equal(record.status,'unavailable');assert.deepEqual(websiteEvidence(record,'company.com').issues,[]);
});
test('model claims, a source link, wrong domain or absent date cannot elevate provider notes to verified evidence',()=>{
 const record=inspectOfficialHtml({url,html:html('<title>Company</title>')},date);
 for(const change of [{method:'model-verified'},{sourceUrl:'https://company.com.evil.test/'},{checkedAt:''},{sourceUrl:'javascript:alert(1)'},{sourceUrl:'https://user:secret@company.com/'}])assert.deepEqual(websiteEvidence({...record,...change},'company.com').issues,[]);
 assert.equal(websiteEvidence({...record,checks:[{key:'google-profile-missing',present:false,text:'No Google profile'}]},'company.com').checked,false);
});
test('provider estimates and generic suggestions cannot boost outreach priority',()=>{
 const candidate={id:'a',domain:'company.com',qualificationScore:80,scanProvider:'Gemini',scanScore:10,scanFindings:['NAP consistency needs to be checked'],scanRecommendations:['Create a Google Business Profile']};
 const rows=evaluateOutreachPool([candidate,{...candidate,id:'b',scanScore:90,scanRecommendations:Array(5).fill('Add service schema markup')}]).ranked;
 assert.equal(rows[0].selectionPriority,rows[1].selectionPriority);assert.ok(rows.every(x=>!x.selectionReasons.some(r=>r.includes('tamamlanmış analizde ihtiyaç'))));
});
test('safe enquiry permits first and follow-up templates; stale and edited claims blocked',()=>{
 const x={name:'Company',country:'Germany',outreachDraft:'Your visibility is 25/100 and your Google profile is missing.'};assert.equal(safeFirstContact(x),false);
 assert.equal(safeFirstContact({...x,outreachDraft:permissionEnquiry(x)}),true);assert.equal(safeFirstContact({...x,outreachDraft:permissionEnquiry(x,true)}),true);
 assert.equal(safeFirstContact({...x,outreachDraft:permissionEnquiry(x)+' We verified a missing profile.'}),false);
});

test('a model cannot mark its own unsupported observations as verified',async()=>{
 const {readFile}=await import('node:fs/promises');
 const source=await readFile(new URL('../lib/providers.js',import.meta.url),'utf8');
 const part=source.slice(source.indexOf('function normalizeProviderResult('),source.indexOf('export async function runProviderChecks('));
 const run=new Function('costContext','recordProviderHealth',part+';return observedRun;')({run:async(_,fn)=>fn()},async()=>{});
 const inspection={method:'official-html-v1',status:'unavailable',checks:[]};
 const result=await run('Gemini',async()=>({score:25,findings:['Google profile is missing'],recommendations:['Create Google profile'],evidence:{method:'official-html-v1',status:'checked',checks:[{key:'google-profile-missing',present:false}]}}),{websiteInspection:inspection});
 assert.equal(result.evidence,inspection);assert.deepEqual(websiteEvidence(result.evidence,'company.com').issues,[]);
});
