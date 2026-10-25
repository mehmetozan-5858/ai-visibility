import test from 'node:test';import assert from 'node:assert/strict';
import {ZERA_TASKS,zeraTaskSummary,shouldStopZeraRun} from '../lib/zera-evidence-orchestrator.mjs';
test('ZERA has exactly five Google and two AI tasks',()=>{assert.equal(ZERA_TASKS.length,7);assert.equal(ZERA_TASKS.filter(x=>x.channel==='google').length,5)});
test('no fabricated evidence',()=>{const s=zeraTaskSummary();assert.equal(s.verified,0);assert.equal(s.pending,7)});
test('unverified and misclassified AI answers do not satisfy search tasks',()=>{const s=zeraTaskSummary([{taskId:'brand-google-de',channel:'ai-answer',status:'evidence-recorded',verified:true,sourceUrl:'https://example.org'}]);assert.equal(s.verified,0)});
test('only source-backed channel-matched evidence counts',()=>{const s=zeraTaskSummary([{taskId:'brand-ai-de',channel:'ai-answer',status:'evidence-recorded',verified:true,sourceUrl:'https://example.org'}]);assert.equal(s.verified,1)});
test('run stops on closed gate, rate limits, or exhausted attempts',()=>{assert.equal(shouldStopZeraRun({}),'gate-closed');assert.equal(shouldStopZeraRun({enabled:true,freeTierConfirmed:true,providerStatus:'provider-quota-or-rate-limit'}),'provider-stop');assert.equal(shouldStopZeraRun({enabled:true,freeTierConfirmed:true,attempts:2}),'attempt-limit')});
