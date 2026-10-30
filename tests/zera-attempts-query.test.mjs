import test from 'node:test';
import assert from 'node:assert/strict';
import {zeraAttemptsSelectQuery} from '../lib/zera-attempts-query.mjs';

const legacy='SELECT task_id AS "taskId",status,comparison_id AS "comparisonId" FROM zera_ai_task_attempts WHERE client_id=$1';

test('ZERA status GET supports a historical table without failure_reason',()=>{
 assert.equal(zeraAttemptsSelectQuery(),legacy);
 assert.equal(zeraAttemptsSelectQuery(false),legacy);
 assert.equal(zeraAttemptsSelectQuery(undefined),legacy);
});

test('ZERA status GET exposes safe failure category only when column exists',()=>{
 assert.equal(zeraAttemptsSelectQuery(true),'SELECT task_id AS "taskId",status,comparison_id AS "comparisonId",failure_reason AS "failureReason" FROM zera_ai_task_attempts WHERE client_id=$1');
});

test('ZERA status query does not interpolate non-boolean or user input',()=>{
 for(const value of [null,0,1,'true','failure_reason; DROP TABLE zera_ai_task_attempts',{},[]]){
  assert.equal(zeraAttemptsSelectQuery(value),legacy);
 }
});
