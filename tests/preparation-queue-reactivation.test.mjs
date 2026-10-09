import test from 'node:test';
import assert from 'node:assert/strict';
import {enqueuePreparation} from '../lib/preparation-queue.js';

function candidate(overrides={}){
  return {
    id:'11111111-1111-4111-8111-111111111111',
    status:'new',
    qualificationLevel:'high',
    qualificationScore:80,
    communicationStatus:'',
    contactStatus:'',
    selectionPriority:60,
    selectionBlocked:'',
    replyStatus:'',
    clientId:null,
    crmStage:'new',
    name:'Industrial Calibration GmbH',
    ...overrides,
  };
}

test('stale done preflight can be reactivated only when no active downstream job exists',async()=>{
  let sql='';
  const pool={query:async(q)=>{sql=String(q);return {rows:[{id:'job'}]}}};
  const count=await enqueuePreparation([candidate()],pool);
  assert.equal(count,1);
  assert.match(sql,/status='done'/);
  assert.match(sql,/NOT EXISTS/);
  assert.match(sql,/downstream\.stage IN \('analysis','contact'\)/);
  assert.match(sql,/THEN 'pending'/);
  assert.match(sql,/THEN 0 ELSE prospect_preparation_jobs\.attempts/);
});

test('already ready-for-review prospect is not requeued for preparation',async()=>{
  let called=false;
  const pool={query:async()=>{called=true;return {rows:[]}}};
  const count=await enqueuePreparation([candidate({communicationStatus:'ready-for-review'})],pool);
  assert.equal(count,0);
  assert.equal(called,false);
});

test('security-review and contacted records remain excluded before queue write',async()=>{
  let called=false;
  const pool={query:async()=>{called=true;return {rows:[]}}};
  const count=await enqueuePreparation([
    candidate({selectionBlocked:'identity-review-required'}),
    candidate({communicationStatus:'sent'}),
    candidate({replyStatus:'interested'}),
  ],pool);
  assert.equal(count,0);
  assert.equal(called,false);
});
