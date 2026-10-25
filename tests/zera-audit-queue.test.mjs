import test from 'node:test';
import assert from 'node:assert/strict';
import {createPilot} from '../pilot/zera-pilot.mjs';
import {AUDIT_TASKS,buildAuditQueue,recordAuditResult,auditProgress} from '../pilot/zera-audit-queue.mjs';
test('7 audit jobs are planned, none falsely executed',()=>{
 const tasks=buildAuditQueue();
 assert.equal(tasks.length,7);
 assert.equal(auditProgress(tasks).completed,0);
 assert.ok(tasks.every(t=>t.status==='awaiting_provider_execution'));
});
test('no task may exceed authorized scope',()=>{
 const pilot=createPilot();pilot.consent.authorizedScopes=['public_brand_audit'];
 assert.throws(()=>buildAuditQueue(pilot),/Consent/);
});
test('audit evidence must be observed with timestamp and source',()=>{
 const task=buildAuditQueue()[0];
 assert.throws(()=>recordAuditResult(task,{taskId:task.id,evidence:{type:'hypothesis'}}));
 const observed=recordAuditResult(task,{taskId:task.id,evidence:{type:'observed',sourceUrl:'https://example.com',observedAt:'2026-10-24',query:task.query,observation:'Example, not an actual pilot finding'}});
 assert.equal(observed.status,'evidence_recorded');
 assert.equal(auditProgress([observed]).completionPercent,100);
});
