import test from "node:test";
import assert from "node:assert/strict";
import {analyzeAgentOperations as analyze} from "../lib/ai-visibility-agent-audit-analysis.mjs";
const agent={id:"agent_1",runs:20,failures:3,humanHandoffs:2,estimatedCostCents:12000};
test("flags high failure rate and review cost",()=>{
 const r=analyze({agents:[agent]});assert.equal(r.ok,true);
 assert.equal(r.agents[0].failureRatePercent,15);
 assert.deepEqual(r.agents[0].flags,["high-failure-rate","cost-review"]);
 assert.equal(r.summary.flaggedCount,1);
});
test("zero-run agent does not divide by zero",()=>{
 const r=analyze({agents:[{...agent,runs:0,failures:0,humanHandoffs:0,estimatedCostCents:0}]});
 assert.equal(r.agents[0].failureRatePercent,0);assert.deepEqual(r.agents[0].flags,[]);
});
test("rejects impossible and negative counters",()=>{
 assert.equal(analyze({agents:[{...agent,failures:21}]}).ok,false);
 assert.equal(analyze({agents:[{...agent,estimatedCostCents:-1}]}).ok,false);
});
test("rejects unbounded and unsafe agent ids",()=>{
 assert.equal(analyze({agents:[{...agent,id:"<script>"}]}).ok,false);
 assert.equal(analyze({agents:Array(101).fill(agent)}).ok,false);
});
test("does not copy raw prompts or secrets to output",()=>{
 const r=analyze({agents:[{...agent,prompt:"PRIVATE PROMPT",apiKey:"SECRET"}]});
 assert.equal(JSON.stringify(r).includes("PRIVATE PROMPT"),false);
 assert.equal(JSON.stringify(r).includes("SECRET"),false);
});
