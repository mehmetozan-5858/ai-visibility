import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("checkout remains private from search and keeps the real payment manager",()=>{
  const page=read("app/odeme/page.js");
  assert.match(page,/PaymentManager/);
  assert.match(page,/robots:\{index:false,follow:false/);
  assert.match(page,/SECURE CHECKOUT/);
  assert.match(page,/Mesafeli Hizmet Sözleşmesi/);
  assert.match(page,/\/iptal-iade/);
  assert.match(page,/\/musteri-giris/);
});

test("checkout has responsive accessible premium styles loaded globally",()=>{
  const layout=read("app/layout.js");
  const css=read("app/checkout-premium.css");
  assert.match(layout,/checkout-premium\.css/);
  for(const token of [".checkout-shell",".checkout-intro",".checkout-trust",".checkout-legal","focus-visible","prefers-reduced-motion"]){
    assert.ok(css.includes(token),token);
  }
  assert.match(css,/@media\(max-width:850px\)/);
  assert.match(css,/@media\(max-width:560px\)/);
});

test("root metadata does not apply a duplicate brand title template",()=>{
  const layout=read("app/layout.js");
  assert.match(layout,/title:"AI Visibility"/);
  assert.doesNotMatch(layout,/template:/);
});
