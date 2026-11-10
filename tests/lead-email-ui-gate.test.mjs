import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
test("optional lead verification UI appears only after a successful saved application",async()=>{
 const form=await readFile(new URL("../components/NewCustomerLeadForm.js",import.meta.url),"utf8");
 const component=await readFile(new URL("../components/LeadEmailVerification.js",import.meta.url),"utf8");
 assert.match(form,/setSubmittedLead\(\{id:d\.lead\.id,email:form\.email\.trim\(\)\.toLowerCase\(\)\}\)/);
 assert.match(form,/ok&&submittedLead&&<LeadEmailVerification/);
 assert.match(component,/NEXT_PUBLIC_LEAD_EMAIL_VERIFICATION_ENABLED==="true"/);
 assert.match(component,/if\(!PUBLIC_ENABLED\|\|!leadId\|\|!email\)return null/);
 assert.match(component,/fetch\("\/api\/lead-email\/"\+path/);
 assert.doesNotMatch(component,/createClientToken|Paddle\.Checkout|window\.location\.replace/);
});
