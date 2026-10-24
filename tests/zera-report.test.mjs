import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAuditQueue,recordAuditResult} from '../pilot/zera-audit-queue.mjs';
import {buildPilotReport,formatPilotReportMarkdown,resolveReportLanguage} from '../pilot/zera-report.mjs';
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

test('reports support Turkish and English while the evidence remains unchanged',()=>{
 const report=buildPilotReport(buildAuditQueue(),{asOf:'2026-10-24'});
 assert.match(formatPilotReportMarkdown(report,{language:'tr'}),/Henüz doğrulanmış tarama sonucu yok/);
 assert.match(formatPilotReportMarkdown(report,{language:'en'}),/No verified scan results yet/);
 assert.equal(report.pendingTasks.length,7);
});

test('customer defaults: Turkey Turkish, international English, owner may override',()=>{
 assert.equal(resolveReportLanguage({country:'Türkiye'}),'tr');
 assert.equal(resolveReportLanguage({country:'TR'}),'tr');
 assert.equal(resolveReportLanguage({country:'Germany'}),'en');
 assert.equal(resolveReportLanguage({country:'DE'}),'en');
 assert.equal(resolveReportLanguage({country:'DE',language:'tr'}),'tr');
 const report=buildPilotReport(buildAuditQueue());
 assert.match(formatPilotReportMarkdown(report,{country:'TR'}),/Henüz doğrulanmış tarama sonucu yok/);
 assert.match(formatPilotReportMarkdown(report,{country:'DE'}),/No verified scan results yet/);
});

test('evidence coverage is not mistaken for AI visibility score',()=>{
 const empty=buildPilotReport(buildAuditQueue());
 assert.equal(empty.scores.value,0);
 assert.equal(empty.scores.visibilityScore,null);
 const task=buildAuditQueue()[0];
 const verified=recordAuditResult(task,{taskId:task.id,evidence:{type:'observed',sourceUrl:'https://example.org',observedAt:'2026-10-25',observation:'Test citation'}});
 const partial=buildPilotReport([verified]);
 assert.equal(partial.scores.value,14);
 assert.equal(partial.scores.visibilityScore,null);
});
