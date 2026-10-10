import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("public root uses the premium evidence-led marketing experience",()=>{
  const root=read("app/page.js");
  const preview=read("app/site-preview/page.jsx");
  assert.match(root,/SitePreviewHome/);
  assert.match(root,/Digital Visibility Intelligence/);
  assert.match(root,/canonical:"\/"/);
  assert.match(preview,/DEMO/);
  assert.match(preview,/Belirli sıralama, satış veya gelir sonucu garanti edilmez/);
});

test("robots keeps customer admin api and preview workspaces out of search",()=>{
  const robots=read("app/robots.js");
  for(const path of ["/admin","/login","/lead-finder","/musteri-panel","/site-preview","/portal-preview","/api/"]){
    assert.ok(robots.includes(`\"${path}\"`),path);
  }
  assert.match(robots,/sitemap:/);
});

test("sitemap contains public commercial trust and legal routes only",()=>{
  const sitemap=read("app/sitemap.js");
  for(const path of ["/hizmetler","/hakkimizda","/iletisim","/yeni-musteri","/musteri-giris","/gizlilik","/kvkk","/mesafeli-hizmet-sozlesmesi","/iptal-iade"]){
    assert.ok(sitemap.includes(`\"${path}\"`),path);
  }
  for(const hidden of ["/admin","/lead-finder","/musteri-panel","/site-preview","/portal-preview"]){
    assert.ok(!sitemap.includes(`\"${hidden}\"`),hidden);
  }
});
