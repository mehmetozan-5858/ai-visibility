import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("demo report uses localized labels rather than English-only strings",()=>{
 const page=read("app/site-preview/page.jsx");
 for(const marker of ['reportLabels:["Keşif","Kanıt","Hazırlık"]','reportLabels:["Discovery","Evidence","Readiness"]','findingTitle:"Öncelikli bulgu"','findingTitle:"Priority finding"','{t.reportName}','{t.findingText}','t.reportLabels.map'])assert.ok(page.includes(marker),marker);
 assert.doesNotMatch(page,/<b>Priority finding<\/b>/);
});
test("mobile trust checklist is compact and sections have reduced spacing",()=>{
 const css=read("app/site-preview/premium-visual.css");
 assert.match(css,/\.trust-list\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/\.trust-item\{min-height:88px;padding:16px 18px/);
 assert.match(css,/@media\(max-width:700px\)\{\s*\.site-preview \.section\{padding-top:44px;padding-bottom:44px\}/);
 assert.match(css,/\.trust-item\{min-height:0;padding:13px 15px/);
});
