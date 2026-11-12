import test from 'node:test';
import assert from 'node:assert/strict';
import {applicantEmailResumeHref,applicantEmailResumeId} from '../lib/applicant-email-resume.mjs';
const id='11111111-1111-4111-8111-111111111111';
test('resume carries only a lead reference in a fragment, never a credential',()=>{
 assert.equal(applicantEmailResumeHref(id),'/basvuru-dogrula#lead='+id);
 assert.equal(applicantEmailResumeId('#lead='+id),id);
 assert.equal(applicantEmailResumeId('',{aivApplicantLead:id,email:'ignored@example.test',code:'ignored'}),id);
});
test('invalid and ambiguous references cannot restore verification context',()=>{
 for(const hash of ['#lead=bad','#lead='+id+'&lead='+id,'#lead='+id+'&email=other@example.test','#code=123456','#lead='+id+'&token=x'])assert.equal(applicantEmailResumeId(hash,{aivApplicantLead:id}),null);
 for(const value of ['',null,{},'https://other.example/'+id])assert.equal(applicantEmailResumeHref(value),null);
 assert.equal(applicantEmailResumeId('',{}),null);
});
