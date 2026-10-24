import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync(new URL("../docs/ai-visibility-launch-schema.sql",import.meta.url),"utf8");
test("migration scopes both tables to existing clients",()=>{
 assert.match(sql,/ai_visibility_launch_entitlements[\s\S]*client_id UUID NOT NULL REFERENCES clients\(id\)/);
 assert.match(sql,/ai_visibility_launch_events[\s\S]*client_id UUID NOT NULL REFERENCES clients\(id\)/);
});
test("entitlements are unique by customer and service",()=>{
 assert.match(sql,/PRIMARY KEY\(client_id,service_id\)/);
 assert.match(sql,/FOREIGN KEY \(client_id,service_id\)/);
});
test("revocation and expiration exist",()=>{
 for(const value of ["revoked_at","expires_at","consent_verified_at"])assert.ok(sql.includes(value));
});
test("audit data has no resume or recording text columns",()=>{
 assert.doesNotMatch(sql,/resume_body|recording_blob|raw_transcript/);
});
