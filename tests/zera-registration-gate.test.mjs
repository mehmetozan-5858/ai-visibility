import test from "node:test";
import assert from "node:assert/strict";
import {zeraRegistrationGate as gate} from "../pilot/zera-registration-gate.mjs";
const flags={VERCEL_ENV:"preview",ZERA_ISOLATED_PREVIEW_DB:"verified",ZERA_PILOT_REGISTRATION_ENABLED:"true"};
test("rejects production even when all preview flags are set",()=>{
 const r=gate({...flags,VERCEL_ENV:"production"});
 assert.equal(r.allowed,false);assert.equal(r.reason,"registration-preview-only");
});
test("rejects development and missing environment",()=>{
 assert.equal(gate({...flags,VERCEL_ENV:"development"}).allowed,false);
 assert.equal(gate({}).allowed,false);
});
test("rejects unverified preview database",()=>{
 const r=gate({...flags,ZERA_ISOLATED_PREVIEW_DB:"unverified"});
 assert.equal(r.allowed,false);assert.equal(r.reason,"preview-db-isolation-unverified");
});
test("requires explicit opt-in even with verified preview isolation",()=>{
 const r=gate({...flags,ZERA_PILOT_REGISTRATION_ENABLED:undefined});
 assert.equal(r.allowed,false);assert.equal(r.reason,"registration-not-enabled");
});
test("allows only explicitly enabled isolated preview",()=>{
 assert.deepEqual(gate(flags),{allowed:true,reason:"isolated-preview-registration-enabled"});
});
