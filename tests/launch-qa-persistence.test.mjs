import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('launch QA persistence stores only stage timestamps',()=>{
  const source=fs.readFileSync(new URL('../lib/launch-qa-status.js',import.meta.url),'utf8');
  assert.match(source,/aiv_launch_qa_status_v1/);
  assert.match(source,/stage5At/);
  assert.match(source,/stage6At/);
  assert.doesNotMatch(source,/password|verificationCode|emailMasked|transactionId/);
});

test('settings test center restores stage 5 success and records a new success',()=>{
  const source=fs.readFileSync(new URL('../components/TestCenter.js',import.meta.url),'utf8');
  assert.match(source,/readLaunchQaStatus/);
  assert.match(source,/markLaunchQaStage\("stage5"\)/);
  assert.match(source,/Son başarılı doğrulama/);
});

test('launch console restores stage 5 and stage 6 status without persisting credentials',()=>{
  const source=fs.readFileSync(new URL('../components/LaunchQAConsole.js',import.meta.url),'utf8');
  assert.match(source,/readLaunchQaStatus/);
  assert.match(source,/markLaunchQaStage\("stage5"\)/);
  assert.match(source,/markLaunchQaStage\("stage6"\)/);
  assert.match(source,/Son başarılı Paddle LIVE doğrulaması/);
  assert.doesNotMatch(source,/localStorage\.setItem\([^\n]*(password|email|code)/);
});
