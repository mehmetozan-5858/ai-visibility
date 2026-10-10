import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("each solution card has its own professional illustration",()=>{
  const css=read("app/sector-visuals.css");
  const layout=read("app/layout.js");
  const page=read("app/site-preview/page.jsx");
  assert.match(layout,/sector-visuals\.css/);
  for(const file of ["manufacturing-export.svg","b2b-expertise.svg","ecommerce-products.svg","digital-agency.svg"]){
    assert.ok(css.includes(`/solutions/${file}`),file);
    const svg=read(`public/solutions/${file}`);
    assert.match(svg,/<svg/);
    assert.match(svg,/viewBox="0 0 800 420"/);
  }
  for(const cls of ["sr1","sr2","sr3","sr4"])assert.ok(page.includes(`sector-rich ${'${'}i+1}`)||page.includes("sector-rich"),cls);
  assert.match(css,/@media\(max-width:700px\)/);
});
