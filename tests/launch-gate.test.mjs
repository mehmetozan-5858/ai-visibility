import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("health endpoint exposes required launch gates without requiring PayTR",()=>{
  const health=read("app/api/health/route.js");
  for(const id of ["database","auth","providers","payments","email","data"]){
    assert.match(health,new RegExp(`id:\\"${id}\\"`));
  }
  assert.match(health,/id:"paytr".*required:false/);
  assert.match(health,/PAYMENT_IBAN/);
  assert.match(health,/SHOPIER_PRODUCTS_JSON/);
  assert.match(health,/RESEND_API_KEY/);
  assert.match(health,/launch:\{ready:/);
});

test("admin launch gate is protected by the existing proxy and linked from desktop navigation",()=>{
  const page=read("app/lansman-kontrol/page.js");
  const ui=read("components/ui.js");
  const proxy=read("proxy.js");
  assert.match(page,/LaunchGate/);
  assert.match(page,/robots:\{index:false,follow:false\}/);
  assert.match(ui,/\/lansman-kontrol/);
  assert.ok(!proxy.includes('"/lansman-kontrol"'),"launch control must not be public");
});

test("launch gate renders required versus optional checks and manual refresh",()=>{
  const gate=read("components/LaunchGate.js");
  const css=read("app/admin-workspace-premium.css");
  assert.match(gate,/ZORUNLU/);
  assert.match(gate,/OPSİYONEL/);
  assert.match(gate,/Kontrolleri yenile/);
  assert.match(gate,/\/api\/health/);
  assert.match(css,/\.launch-status/);
  assert.match(css,/\.launch-grid/);
  assert.match(css,/\.launch-card/);
});
