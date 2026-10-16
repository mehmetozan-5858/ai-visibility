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

test('services page clearly starts an application before payment',()=>{
  const source=fs.readFileSync(new URL('../app/hizmetler/page.js',import.meta.url),'utf8');
  assert.match(source,/Bu paket için başvur/);
  assert.match(source,/Başvuru ve satın alma süreci/);
  assert.match(source,/Başvurunuz değerlendirildikten sonra uygun ödeme adımında/);
  assert.doesNotMatch(source,/Satın Alma Sürecini Başlat/);
});

test('demo explains sample data, application boundary and publishes WebPage schema',()=>{
  const page=fs.readFileSync(new URL('../app/demo/page.js',import.meta.url),'utf8');
  const layout=fs.readFileSync(new URL('../app/demo/layout.js',import.meta.url),'utf8');
  assert.match(page,/Bu demoda neyi inceleyebilirsiniz/);
  assert.match(page,/Başvuru doğrudan ücretli üyelik veya otomatik hesap açılışı değildir/);
  assert.match(page,/Ücretsiz ön değerlendirme/);
  assert.match(layout,/"@type":"WebPage"/);
  assert.match(layout,/https:\/\/www\.aivisibilityworks\.com\/demo#webpage/);
});

test('demo uses the same service language as live pricing instead of an undefined Pro tier',()=>{
  const page=fs.readFileSync(new URL('../app/demo/page.js',import.meta.url),'utf8');
  assert.match(page,/Aktif hizmet/);
  assert.match(page,/Tam Rapor/);
  assert.match(page,/analiz veya hizmet kapsamı aktive edilmiş müşterilere/);
  assert.doesNotMatch(page,/Pro Raporu|Pro müşterilere|Pro için/);
});

test('published legal pages do not tell customers legal identity will be added before launch',()=>{
  const privacy=fs.readFileSync(new URL('../app/gizlilik/page.js',import.meta.url),'utf8');
  const contact=fs.readFileSync(new URL('../app/iletisim/page.js',import.meta.url),'utf8');
  assert.match(privacy,/DATA_CONTROLLER_NAME/);
  assert.match(privacy,/KVKK Aydınlatma Metni/);
  assert.match(contact,/DATA_CONTROLLER_NAME/);
  assert.doesNotMatch(privacy,/ticari yayına geçmeden önce/);
  assert.doesNotMatch(contact,/Ticari yayına geçmeden önce/);
});

test('customer login sends new visitors to application and localizes customer-facing hero copy',()=>{
  const source=fs.readFileSync(new URL('../components/CustomerLoginForm.js',import.meta.url),'utf8');
  assert.match(source,/Yeni müşteriyim \/ Başvuruyu başlat/);
  assert.match(source,/I’m a new customer \/ Start application/);
  assert.match(source,/Manage your AI visibility from one place/);
  assert.match(source,/Secure customer area/);
  assert.match(source,/href="\/yeni-musteri"/);
});

test('Paddle live checkout is localized and emits consent-gated checkout analytics',()=>{
  const source=fs.readFileSync(new URL('../components/PaddleLiveCheckout.js',import.meta.url),'utf8');
  assert.match(source,/Secure card payment/);
  assert.match(source,/Continue securely with Paddle/);
  assert.match(source,/trackAnalyticsEvent\('begin_checkout'/);
  assert.match(source,/payment_provider:'paddle'/);
});

test('analytics consent controls have English and Turkish customer copy',()=>{
  const source=fs.readFileSync(new URL('../components/AnalyticsConsent.js',import.meta.url),'utf8');
  assert.match(source,/Cookie preferences/);
  assert.match(source,/Necessary only/);
  assert.match(source,/Çerez tercihleri/);
  assert.match(source,/Yalnız zorunlu/);
});
