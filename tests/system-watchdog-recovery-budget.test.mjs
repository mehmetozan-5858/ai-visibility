import test from 'node:test';
import assert from 'node:assert/strict';
import {
  boundedWatchdogRecoveries,
  MAX_WATCHDOG_RECOVERIES_PER_RUN,
  WATCHDOG_RECOVERY_TIMEOUT_MS,
} from '../lib/system-watchdog-recovery-budget.mjs';

test('watchdog schedules at most two internal recoveries per request',()=>{
  const pending=Array.from({length:20},(_,i)=>({componentKey:`cycle-${i}`,route:`/api/cycle-${i}`}));
  const selected=boundedWatchdogRecoveries(pending);
  assert.equal(MAX_WATCHDOG_RECOVERIES_PER_RUN,2);
  assert.deepEqual(selected,pending.slice(0,2));
  assert.equal(pending.length,20,'pending recovery list must not be mutated');
});

test('watchdog rejects invalid recovery lists and has a bounded per-request timeout',()=>{
  assert.deepEqual(boundedWatchdogRecoveries(null),[]);
  assert.deepEqual(boundedWatchdogRecoveries({route:'/api/x'}),[]);
  assert.deepEqual(boundedWatchdogRecoveries([]),[]);
  assert.ok(WATCHDOG_RECOVERY_TIMEOUT_MS>0);
  assert.ok(WATCHDOG_RECOVERY_TIMEOUT_MS*MAX_WATCHDOG_RECOVERIES_PER_RUN<30000);
});
