import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAuditQueue,recordAuditResult} from '../pilot/zera-audit-queue.mjs';
import {buildPilotReport,formatPilotReportMarkdown} from '../pilot/zera-report.mjs';
test('unmeasured tasks remain pending rather than silently passing',()=>{
 const report=buildPilotReport(buildAuditQueue(),{asOf:'2026-10-24'});
 assert.equal(report.progress.completed,0);assert.equal(report.pendingTasks.length,7);
 assert.match(formatPilotReportMarkdown(report),/No verified scan results yet/);
});
test('cross-pilot records and duplicates are rejected',()=>{
 const one=buildAuditQueue()[0];
 assert.throws(()=>buildPilotReport([{...one,pilotId:'OTHER'}]));
 assert.throws(()=>buildPilotReport([one,one]));
});
test('verified result requires evidence',()=>{
 const one=buildAuditQueue()[0];
 assert.throws(()=>buildPilotReport([{...one,status:'evidence_recorded',evidence:null}]));
 const observed=recordAuditResult(one,{taskId:one.id,evidence:{type:'observed',sourceUrl:'https://example.com',observedAt:'2026-10-24',observation:'Synthetic test fixture'}});
 const report=buildPilotReport([observed]);
 assert.equal(report.progress.completed,1);assert.equal(report.pendingTasks.length,6);
});
