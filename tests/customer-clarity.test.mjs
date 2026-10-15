import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('public navigation distinguishes assessment from product demo',()=>{
  const source=fs.readFileSync(new URL('../components/PublicPage.js',import.meta.url),'utf8');
  assert.match(source,/Ücretsiz ön değerlendirme/);
  assert.doesNotMatch(source,/Ücretsiz demo al/);
  assert.doesNotMatch(source,/Yönetici Girişi/);
});

test('homepage distinguishes assessment CTA from product demo and publishes organization logo',()=>{
  const source=fs.readFileSync(new URL('../app/page.js',import.meta.url),'utf8');
  assert.match(source,/Ücretsiz ön değerlendirme/);
  assert.doesNotMatch(source,/Ücretsiz demo al/);
  assert.match(source,/logo:"https:\/\/www\.aivisibilityworks\.com\/icon\.png"/);
  assert.match(source,/href="\/demo">◉ Ürün demosunu incele/);
});

test('customer login sends new visitors to application rather than promising account creation',()=>{
  const source=fs.readFileSync(new URL('../components/CustomerLoginForm.js',import.meta.url),'utf8');
  assert.match(source,/Yeni müşteriyim \/ Başvuruyu başlat/);
  assert.match(source,/I’m a new customer \/ Start application/);
  assert.match(source,/href="\/yeni-musteri"/);
});
