import test from "node:test";
import assert from "node:assert/strict";
import {bridgeTrialReadiness} from "../lib/ai-bridge-trial-readiness.mjs";
test("disabled trial is not ready even with key",()=>{
  const r=bridgeTrialReadiness({OPENROUTER_API_KEY:"private-example"});
  assert.equal(r.configuredForTrial,false);
  assert.equal(r.inferenceVerified,false);
  assert.equal(JSON.stringify(r).includes("private-example"),false);
});
test("enabled without key stays blocked",()=>{
  assert.equal(bridgeTrialReadiness({AI_BRIDGE_INFERENCE_ENABLED:"true"}).nextAction,"configure-private-server-key");
});
test("enabled with key means configured, not verified",()=>{
  const r=bridgeTrialReadiness({AI_BRIDGE_INFERENCE_ENABLED:"true",OPENROUTER_API_KEY:"private-example"});
  assert.equal(r.configuredForTrial,true);
  assert.equal(r.inferenceVerified,false);
  assert.equal(r.productionModulesEnabled,false);
});
