import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {recipientScopeIssue} from '../lib/recipient-scope.js';
import {preflightProspect} from '../lib/prospect-preflight.js';
const kiwa={name:'Kiwa Turkey — Ankara Branch',country:'Türkiye',city:'Ankara',domain:'kiwa.com',contactEmail:'colombia@kiwa.com',contactSourceUrl:'https://www.kiwa.com/en/about-kiwa/head-office-locations/'};
test('same corporate domain is insufficient when country, city or directory scope conflicts',()=>{
 assert.equal(recipientScopeIssue(kiwa),'contact-country-mismatch');
 assert.equal(recipientScopeIssue({...kiwa,contactEmail:'info@kiwa.com'}),'contact-branch-review-required');
 assert.equal(recipientScopeIssue({...kiwa,contactEmail:'ankara@kiwa.com',contactSourceUrl:'https://www.kiwa.com/colombia/contact'}),'contact-country-mismatch');
 assert.equal(recipientScopeIssue({...kiwa,contactEmail:'istanbul@kiwa.com',contactSourceUrl:'https://www.kiwa.com/tr/contact'}),'contact-city-mismatch');
 assert.equal(recipientScopeIssue({...kiwa,contactEmail:'info@kiwa.com',contactSourceUrl:'https://www.kiwa.com/tr/contact'}),'');
 assert.equal(recipientScopeIssue({country:'Colombia',city:'Bogotá',contactEmail:'colombia@kiwa.com',contactSourceUrl:'https://kiwa.com/co/contact'}),'');
 assert.equal(recipientScopeIssue({country:'Germany',contactEmail:'sales@company.de',contactSourceUrl:'https://company.de/contact'}),'');
 assert.equal(recipientScopeIssue({sourceReview:{method:'manual-source-review-v2',assessment:{decision:'needs-review'}}}),'source-review-needs-review');
});
test('preflight does not certify a foreign office address found on a global directory',async()=>{
 const out=await preflightProspect(kiwa,{read:async url=>({url,html:'<html><head><title>Kiwa offices</title></head><body>Colombia office colombia@kiwa.com</body></html>'})});
 assert.equal(out.contact.status,'not-found');assert.equal(out.contact.email,'');assert.equal(out.reason,'contact-scope-review-required');
});
test('manual and automatic email delivery share scope hold and cannot send needs-review records',async()=>{
 const source=(await readFile(new URL('../lib/outreach-email.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replace(/export /g,'');
 let sends=0;
 const send=new Function('recipientScopeIssue','process','safeFirstContact','buildBrandedOutreachEmail','freeAssessmentUrl','deliverOnce',source+';return sendBrandedOutreach;')(recipientScopeIssue,{env:{}},()=>true,()=>({}),()=>'',async()=>{sends++});
 await assert.rejects(send(kiwa),/contact-country-mismatch/);
 await assert.rejects(send({sourceReview:{method:'manual-source-review-v2',assessment:{decision:'needs-review'}}}),/source-review-needs-review/);
 assert.equal(sends,0);
});
test('an unresolved official-page failure holds the same automatic contact for 24 hours',async()=>{
 const source=(await readFile(new URL('../lib/automatic-outreach.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replace(/export /g,'');
 const blocked=new Function(source+';return blockedRecipient;')();const queries=[];
 const issue=await blocked({query:async(sql,args)=>{queries.push({sql,args});return {rows:[{}]}}},'cal-radon@bfs.de',{id:'radon-id'});
 assert.equal(issue,'contact-verification-hold');assert.equal(queries.length,1);assert.match(queries[0].sql,/INTERVAL '24 hours'/);assert.deepEqual(queries[0].args,['radon-id']);
});
