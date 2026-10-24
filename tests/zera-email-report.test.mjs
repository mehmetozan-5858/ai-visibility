import test from 'node:test';import assert from 'node:assert/strict';
import {buildAuditQueue} from '../pilot/zera-audit-queue.mjs';
import {prepareZeraEmailReport} from '../pilot/zera-email-report.mjs';
test('pending audit email cannot masquerade as final',()=>{
 const x=prepareZeraEmailReport(buildAuditQueue());
 assert.equal(x.sent,false);assert.equal(x.readyForFinalReport,false);
 assert.match(x.subject,/Zwischenstand/);assert.equal(x.verifiedTaskCount,0);
});
test('outbound draft blocks cross-recipient and implicit approval',()=>{
 assert.throws(()=>prepareZeraEmailReport([],{recipient:'someone@example.com'}));
 assert.throws(()=>prepareZeraEmailReport([],{approvedForSending:true}));
});
