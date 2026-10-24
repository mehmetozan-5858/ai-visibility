import test from "node:test";
import assert from "node:assert/strict";
import {parseZeraRegistrationRequest as parse} from "../pilot/zera-registration-input.mjs";
const valid={pilotId:"ZERA-DE-001",confirmPublicPilot:true};
const req=(value,contentType="application/json")=>new Request("https://example.invalid/api/zera-pilot/register",{method:"POST",headers:{"Content-Type":contentType},body:typeof value==="string"?value:JSON.stringify(value)});
test("accepts only explicit two-field pilot confirmation",async()=>{
 assert.deepEqual(await parse(req(valid)),{ok:true,pilotId:"ZERA-DE-001"});
});
test("rejects extra fields even when confirmation is true",async()=>{
 assert.equal((await parse(req({...valid,admin:true}))).ok,false);
});
test("rejects missing or false confirmation",async()=>{
 assert.equal((await parse(req({pilotId:valid.pilotId}))).ok,false);
 assert.equal((await parse(req({...valid,confirmPublicPilot:false}))).ok,false);
});
test("rejects malformed JSON and non-JSON content type",async()=>{
 assert.equal((await parse(req("{", "application/json"))).ok,false);
 assert.equal((await parse(req(valid,"text/plain"))).reason,"invalid-content-type");
});
test("rejects oversized streamed bodies even without content-length",async()=>{
 const r=req({...valid,padding:"x".repeat(600)});
 r.headers.delete("content-length");
 assert.equal((await parse(r)).reason,"request-too-large");
});
test("rejects oversized declared content length without consuming body",async()=>{
 const r=req(valid);r.headers.set("content-length","9000");
 assert.equal((await parse(r)).reason,"request-too-large");
});
