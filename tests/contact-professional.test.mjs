import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("public contact uses only public contact environment variables",()=>{
  const page=read("app/iletisim/page.js");
  assert.match(page,/PUBLIC_CONTACT_EMAIL/);
  assert.match(page,/PUBLIC_CONTACT_PHONE/);
  assert.doesNotMatch(page,/ADMIN_RECOVERY_/);
});

test("public contact keeps transparent fallback and legal routes",()=>{
  const page=read("app/iletisim/page.js");
  assert.match(page,/Henüz yayımlanmadı/);
  assert.match(page,/e-posta ile başvuru alındığı iddia edilmez/);
  for(const route of ["/hizmetler","/musteri-giris","/gizlilik","/mesafeli-hizmet-sozlesmesi","/iptal-iade"]){
    assert.ok(page.includes(route),route);
  }
});

test("premium contact layout is responsive and accessible",()=>{
  const css=read("app/iletisim/contact-premium.css");
  for(const token of [".contact-premium-grid",".contact-trust-strip",".contact-next-actions",":focus-visible","@media(max-width:900px)","@media(max-width:560px)"]){
    assert.ok(css.includes(token),token);
  }
});
