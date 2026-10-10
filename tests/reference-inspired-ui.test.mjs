import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("reference-inspired hero shows four intelligence modules around real demo shell",()=>{
 const jsx=read("app/site-preview/page.jsx");
 const css=read("app/site-preview/premium-visual.css");
 for(const cls of ["reference-hero-visual","reference-orbit","rf-search","rf-evidence","rf-strategy","rf-actions"])assert.ok(jsx.includes(cls),cls);
 assert.match(css,/\.reference-float\{/);
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(jsx,/className="demo-tag">DEMO/);
});
test("client and admin share approved dashboard visual language without hardcoded business data",()=>{
 for(const path of ["app/customer-portal-premium.css","app/admin-workspace-premium.css"]){
 const css=read(path);
 assert.match(css,/background-size:auto,44px 44px,44px 44px,auto/);
 assert.match(css,/#0a2737/);
 assert.match(css,/@media\(max-width:700px\)/);
 }
});
