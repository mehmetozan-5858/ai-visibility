import test from 'node:test';
import assert from 'node:assert/strict';
import {createPilot} from '../pilot/zera-pilot.mjs';
import {runPublicPilotAudit} from '../pilot/zera-runner.mjs';
test('no execution happens without explicit approval and configured adapter',async()=>{
 let calls=0;
 const executor=async()=>{calls++;};
 await assert.rejects(runPublicPilotAudit({pilot:createPilot(),executor}),/approval/);
 await assert.rejects(runPublicPilotAudit({pilot:createPilot(),approved:true}),/executor/);
 assert.equal(calls,0);
});
test('verified provider evidence is accepted; failures never inflate completion',async()=>{
 const result=await runPublicPilotAudit({pilot:createPilot(),approved:true,maxTasks:2,executor:async task=>{
  if(task.id==='local-google-de')throw new Error('Provider unavailable');
  return {taskId:task.id,evidence:{type:'observed',sourceUrl:'https://example.org/sample',
    observedAt:'2026-10-24',query:task.query,observation:'Synthetic fixture; not real ZERA search result'}};
 }});
 assert.equal(result.executedTasks,2);
 assert.equal(result.verifiedResults,1);
 assert.equal(result.report.pendingTasks.length,6);
 assert.equal(result.tasks[1].status,'awaiting_provider_execution');
});
test('an unauthorized scope blocks the run before executor use',async()=>{
 const pilot=createPilot();pilot.consent.authorizedScopes=[];
 let calls=0;
 await assert.rejects(runPublicPilotAudit({pilot,approved:true,executor:async()=>{calls++}}),/Consent/);
 assert.equal(calls,0);
});
