import test from 'node:test';
import assert from 'node:assert/strict';
import { renderIntroOutreach } from '../lib/outreach-intro-email.mjs';
const base = {language:'en',company:'Example Ltd',industry:'retail',firstName:'Alex',approved:true,lawfulBasisVerified:true,suppressionChecked:true};
test('renders price-free invitation without sending', () => {
 const v=renderIntroOutreach(base);
 assert.match(v.subject,/Example Ltd/);
 assert.match(v.text,/complimentary initial check/);
 assert.doesNotMatch(v.text,/\$\d|€\d|monthly plan|pricing table/i);
});
test('rejects missing approvals', () => {
 for(const key of ['approved','lawfulBasisVerified','suppressionChecked'])
  assert.throws(()=>renderIntroOutreach({...base,[key]:false}),/OUTREACH_NOT_APPROVED/);
});
test('rejects injection and missing fields', () => {
 assert.throws(()=>renderIntroOutreach({...base,company:'X\nBcc: test@example.org'}));
 assert.throws(()=>renderIntroOutreach({...base,industry:''}));
});
test('renders Turkish variant',()=>{
 const v=renderIntroOutreach({...base,language:'tr'});
 assert.match(v.text,/ücretsiz bir ön kontrol/);
});

test('follow-up has distinct subject but no price',()=>{
 const v=renderIntroOutreach({...base,followUp:true});
 assert.match(v.subject,/Brief follow-up/);
 assert.match(v.text,/earlier note/);
 assert.ok(v.text.includes('again.'+String.fromCharCode(10,10)+'When someone'));
 assert.equal(v.text.includes(String.fromCharCode(92,110)),false);
 assert.doesNotMatch(v.text,/€|£|\$[0-9]|monthly plan/);
});
