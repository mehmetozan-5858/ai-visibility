import test from 'node:test';
import assert from 'node:assert/strict';
import {officialEmails,contactLinks,preflightProspect} from '../lib/prospect-preflight.js';
const html=body=>`<!doctype html><html><head><title>Company</title></head><body>${body}</body></html>`;
test('preflight accepts only explicitly published official emails, excluding scripts/comments and off-domain addresses',()=>{
 assert.deepEqual(officialEmails(html('<!-- fake@company.com --><script>hidden@company.com</script> sales@company.com bad@company.com.evil.org personal@gmail.com info&#64;company.com'),'company.com'),['sales@company.com','info@company.com']);
 assert.deepEqual(officialEmails(html('No email available'),'company.com'),[]);
});
test('contact links stay on official HTTPS domain and reject IPs, credentials, external redirects',()=>{
 const links=contactLinks(html('<a href="/contact">Contact</a><a href="https://company.com.evil.org/contact">Contact</a><a href="http://company.com/contact">Contact</a><a href="https://user:password@company.com/contact">Contact</a>'),'https://company.com/','company.com');assert.deepEqual(links,['https://company.com/contact']);
});
test('official contact extraction follows actual links and retains narrow evidence, without guessing an address',async()=>{
 const calls=[];const out=await preflightProspect({domain:'company.com'},{read:async url=>{calls.push(url);return {url,html:html(url.endsWith('/contact')?'info@company.com':'<a href="/contact">Contact</a>')}}});assert.equal(out.contact.status,'verified');assert.equal(out.contact.email,'info@company.com');assert.equal(out.contact.sourceUrl,'https://company.com/contact');assert.equal(out.inspection.method,'official-html-v1');assert.equal(calls.length,2);
});
test('challenge pages do not certify an email and network failures have safe codes',async()=>{
 const challenge=await preflightProspect({domain:'company.com'},{read:async url=>({url,html:html('Verify you are human info@company.com')})});assert.equal(challenge.contact.status,'not-found');assert.equal(challenge.reason,'official-page-not-inspectable');
 const failed=await preflightProspect({domain:'company.com'},{read:async()=>{throw Error('sensitive network data')}});assert.equal(failed.reason,'official-page-unavailable');
});
test('preflight never reads more than three pages or revisits a page',async()=>{
 const calls=[];await preflightProspect({domain:'company.com'},{read:async url=>{calls.push(url);return {url,html:html('<a href="/contact">Contact</a><a href="/kontakt">Kontakt</a><a href="/">Contact</a>')}}});assert.equal(calls.length,3);assert.equal(new Set(calls).size,3);
});
