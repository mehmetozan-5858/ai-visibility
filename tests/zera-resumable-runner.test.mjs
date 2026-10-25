import test from 'node:test';import assert from 'node:assert/strict';
import {resumePublicPilotAudit} from '../pilot/zera-resumable-runner.mjs';
import {createPilot} from '../pilot/zera-pilot.mjs';
const pilot=createPilot();
const evidence=task=>({taskId:task.id,evidence:{type:'observed',sourceUrl:'https://example.org/public',observedAt:'2026-10-24T12:00:00Z',observation:'Verified public test observation'}});
test('no consent means no execution or writes',async()=>{
 let n=0;await assert.rejects(resumePublicPilotAudit({pilot,executor:async()=>{n++},load:async()=>[],save:async()=>{n++}}),/approval/);assert.equal(n,0);
});
test('resume executes pending only, preserving verified records',async()=>{
 const saved=[];let calls=0;
 const params={pilot,approved:true,maxTasks:3,executor:async task=>{calls++;return evidence(task)},load:async()=>saved,save:async (_,entry)=>saved.push(entry)};
 const first=await resumePublicPilotAudit(params);assert.equal(first.attempted,3);assert.equal(first.verified,3);
 const second=await resumePublicPilotAudit(params);assert.equal(second.attempted,3);assert.equal(second.verified,6);assert.equal(calls,6);
 const third=await resumePublicPilotAudit(params);assert.equal(third.verified,7);assert.equal(third.attempted,1);
});
test('provider errors never become verified or stored',async()=>{
 let saves=0;const x=await resumePublicPilotAudit({pilot,approved:true,maxTasks:2,executor:async()=>{throw Error('quota')},load:async()=>[],save:async()=>{saves++}});
 assert.equal(x.verified,0);assert.equal(x.report.progress.completed,0);assert.equal(saves,0);
});
