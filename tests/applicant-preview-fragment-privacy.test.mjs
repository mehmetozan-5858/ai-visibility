import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

test("applicant preview captures fragment bearer, then removes it before network request",async()=>{
 const source=await readFile(new URL("../components/ApplicantAssessment.js",import.meta.url),"utf8");
 const read=source.indexOf('new URLSearchParams(window.location.hash.slice(1)).get("token")');
 const clear=source.indexOf('window.history.replaceState(window.history.state,"",window.location.pathname+window.location.search)');
 const request=source.indexOf('fetch("/api/applicant-assessment"');
 assert.ok(read>=0&&clear>read&&request>clear,"fragment must be cleared after capture and before request");
 assert.match(source,/if\(!token\)/);
 assert.match(source,/headers:\{"x-applicant-assessment-token":token\}/);
 assert.doesNotMatch(source,/localStorage|sessionStorage|document\.cookie|location\.href\s*=/);
});
