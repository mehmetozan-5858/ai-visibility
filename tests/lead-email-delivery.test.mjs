import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {sendLeadVerificationEmail} from "../lib/lead-email-delivery.mjs";

test("invalid recipient or code rejected without provider call",async()=>{
 await assert.rejects(sendLeadVerificationEmail("bad","123456"),/invalid-email/);
 await assert.rejects(sendLeadVerificationEmail("customer@example.test","12345"),/invalid-email/);
});
test("failed external delivery never forwards provider response details",async()=>{
 const oldKey=process.env.RESEND_API_KEY,oldFrom=process.env.EMAIL_FROM,oldFetch=globalThis.fetch;
 process.env.RESEND_API_KEY="test-only-not-real";process.env.EMAIL_FROM="noreply@example.test";
 globalThis.fetch=async()=>({ok:false,status:403,text:async()=>"provider-secret-error-body"});
 try{await assert.rejects(sendLeadVerificationEmail("customer@example.test","123456"),e=>e.message==="lead-email-delivery-failed");}
 finally{globalThis.fetch=oldFetch;if(oldKey===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=oldKey;if(oldFrom===undefined)delete process.env.EMAIL_FROM;else process.env.EMAIL_FROM=oldFrom;}
});
test("issued challenge failure cleanup is scoped to same digest and unconsumed state",async()=>{
 const src=await readFile(new URL("../lib/lead-email-verification.mjs",import.meta.url),"utf8");
 assert.match(src,/DELETE FROM public\.lead_email_challenges WHERE lead_id=\$1 AND email=\$2 AND code_digest=\$3/);
 assert.match(src,/verified_at IS NULL AND consumed_at IS NULL/);
 const route=await readFile(new URL("../app/api/lead-email/issue/route.js",import.meta.url),"utf8");
 assert.match(route,/sendLeadVerificationEmail/);
 assert.doesNotMatch(route,/sendVerificationEmail/);
});
