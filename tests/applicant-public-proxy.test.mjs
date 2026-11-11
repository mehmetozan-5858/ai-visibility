import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

test("public applicant routes rely on their own token verification instead of redirecting to admin login",async()=>{
 const source=await readFile(new URL("../proxy.js",import.meta.url),"utf8");
 assert.match(source,/"\/basvuru-analiz"/);
 assert.match(source,/pathname==="\/api\/applicant-assessment"/);
 assert.match(source,/pathname==="\/api\/lead-email\/issue"/);
 assert.match(source,/pathname==="\/api\/lead-email\/verify"/);
 assert.doesNotMatch(source,/publicPages=\[[^\]]*"\/api\/admin\/applicant-assessment-grant"/);
 assert.doesNotMatch(source,/pathname==="\/api\/admin\/applicant-assessment-grant"/);
});
test("applicant preview and email handlers enforce independent authentication or signed grant",async()=>{
 const preview=await readFile(new URL("../app/api/applicant-assessment/route.js",import.meta.url),"utf8");
 const issuer=await readFile(new URL("../app/api/admin/applicant-assessment-grant/route.js",import.meta.url),"utf8");
 for(const path of ["issue","verify"]){
  const source=await readFile(new URL(`../app/api/lead-email/${path}/route.js`,import.meta.url),"utf8");
  assert.match(source,/leadEmailVerificationEnabled\(\)/);
  assert.match(source,/enforceSameOrigin\(req\)/);
 }
 assert.match(preview,/verifyApplicantAssessmentGrant/);
 assert.match(issuer,/await requireAdmin\(req\)/);
});
