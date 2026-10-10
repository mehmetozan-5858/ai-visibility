import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("premium public preview adds visual architecture while keeping demos labeled",()=>{
  const page=read("app/site-preview/page.jsx");
  const css=read("app/site-preview/premium-visual.css");
  assert.match(page,/premium-visual\.css/);
  assert.match(page,/architectureTitle/);
  assert.match(page,/architectureNodes/);
  assert.match(page,/DEMO SYSTEM MAP/);
  assert.match(page,/trustBand/);
  assert.match(css,/\.site-preview \.architecture-visual/);
  assert.match(css,/\.site-preview \.arch-core/);
  assert.match(css,/@media\(max-width:700px\)/);
  assert.match(css,/prefers-reduced-motion/);
});

test("marketing preview avoids fabricated customer-logo social proof",()=>{
  const page=read("app/site-preview/page.jsx");
  assert.doesNotMatch(page,/trusted by|müşterimiz|customer logos|fortune 500/i);
  assert.match(page,/Temsili örnek — gerçek müşteri verisi değildir/);
  assert.match(page,/Belirli sıralama, satış veya gelir sonucu garanti edilmez/);
});
