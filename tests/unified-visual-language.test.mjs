import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("four sector illustrations use shared SVG geometry and unique content",()=>{
 const page=read("app/site-preview/page.jsx");
 assert.match(page,/function SectorVisual\(\{kind\}\)/);
 assert.match(page,/viewBox="0 0 320 180"/);
 for(const marker of ["if(kind===0)","if(kind===1)","if(kind===2)","return frame("])assert.ok(page.includes(marker),marker);
 assert.match(page,/<SectorVisual kind=\{i\}\/>/);
 assert.doesNotMatch(page,/sector-orbit/);
 assert.match(page,/href="\/hizmetler"/);
});
test("shared design tokens keep responsive mobile and real application shells",()=>{
 const visual=read("app/site-preview/premium-visual.css");
 const client=read("app/customer-portal-premium.css");
 const admin=read("app/admin-workspace-premium.css");
 assert.match(visual,/\.sector-diagram/);
 assert.match(visual,/@media\(max-width:700px\)/);
 for(const css of [client,admin]){
  assert.match(css,/--ai-accent:#6ee7ca/);
  assert.match(css,/--ai-outline:#285465/);
 }
});
