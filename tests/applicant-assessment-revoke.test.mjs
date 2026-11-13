import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
test("admin-only revocation invalidates existing signed reports through live state check",async()=>{
 const source=await readFile(new URL("../app/api/admin/applicant-assessment-revoke/route.js",import.meta.url),"utf8");
 const read=await readFile(new URL("../app/api/applicant-assessment/route.js",import.meta.url),"utf8");
 assert.match(source,/await requireAdmin\(req\)/);
 assert.match(source,/enforceSameOrigin\(req\)/);
 assert.match(source,/domainProofEnabled\(\)/);
 assert.match(source,/confirm!=="revoke-applicant-assessment"/);
 assert.match(source,/UPDATE public\.applicant_assessment_links SET revoked_at=NOW\(\)/);
 assert.match(source,/WHERE lead_id=\$1 AND revoked_at IS NULL/);
 assert.match(read,/a\.revoked_at IS NULL/);
 assert.doesNotMatch(source,/DELETE FROM|sendVerificationEmail|Paddle|createApplicantAssessmentGrant/);
});
