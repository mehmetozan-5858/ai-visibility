import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {assessBridgeInferenceRelease} from "../lib/ai-bridge-release-hold.mjs";

const route=readFileSync(new URL("../app/api/admin-ai-bridge-trial/route.js",import.meta.url),"utf8");

test("AI Bridge release remains denied regardless of environment or fake credentials",()=>{
  for(const config of [
    {},
    {AI_BRIDGE_INFERENCE_ENABLED:"true"},
    {AI_BRIDGE_INFERENCE_ENABLED:"true",OPENROUTER_API_KEY:"test-only"},
    {releaseApproved:true,modelId:"cohere/north-mini-code:free"},
  ]) {
    assert.deepEqual(assessBridgeInferenceRelease(config),{
      allowed:false,reason:"inference-release-not-approved",
    });
  }
});

test("admin POST denies before reading request, key or invoking model adapter",()=>{
  const post=route.slice(route.indexOf("export async function POST("));
  const gate=post.indexOf("if(!release.allowed)");
  assert.ok(gate>0,"POST must enforce hard release hold");
  for(const later of ["checkRateLimit(", "process.env.AI_BRIDGE_INFERENCE_ENABLED",
                      "process.env.OPENROUTER_API_KEY", "req.json()", "runFreeBridgeTask("]) {
    assert.ok(post.indexOf(later)>gate,later+" must occur after release denial");
  }
});

test("admin readiness cannot report an approved trial",()=>{
  const get=route.slice(route.indexOf("export async function GET("),route.indexOf("export async function POST("));
  assert.match(get,/releaseApproved:release\\.allowed/);
  assert.match(get,/configuredForTrial:false/);
  assert.match(get,/await-explicit-release-approval/);
});
