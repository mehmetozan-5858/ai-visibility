import test from 'node:test';
import assert from 'node:assert/strict';
import {salesCycleMode} from '../lib/sales-cycle-mode.js';

test('large evidence backlog does not stop discovery when queue has no claimable work',()=>{
 assert.equal(salesCycleMode({awaitingAnalysis:481,claimableTotal:0}),'discovery-and-preparation');
});

test('large backlog may prioritize preparation only when work is actually claimable',()=>{
 assert.equal(salesCycleMode({awaitingAnalysis:481,claimableTotal:1}),'backlog-preparation');
 assert.equal(salesCycleMode({awaitingAnalysis:49,claimableTotal:20}),'discovery-and-preparation');
});
