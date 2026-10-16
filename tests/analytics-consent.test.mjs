import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const consent=fs.readFileSync(new URL('../components/AnalyticsConsent.js',import.meta.url),'utf8');
const analytics=fs.readFileSync(new URL('../lib/analytics-client.js',import.meta.url),'utf8');
const lead=fs.readFileSync(new URL('../components/NewCustomerLeadForm.js',import.meta.url),'utf8');
const privacy=fs.readFileSync(new URL('../app/gizlilik/page.js',import.meta.url),'utf8');

test('GA4 is unavailable without measurement id and defaults analytics consent to denied',()=>{
  assert.match(consent,/NEXT_PUBLIC_GA4_ID/);
  assert.match(consent,/analytics_storage:\s*"denied"/);
  assert.match(consent,/ad_storage:\s*"denied"/);
  assert.match(consent,/if\(!measurementId\)/);
});

test('Google Analytics script is loaded only after granted consent',()=>{
  assert.match(consent,/value==="granted"/);
  assert.match(consent,/if\(saved==="granted"\)loadGa4\(\)/);
  assert.match(consent,/googletagmanager\.com\/gtag\/js/);
  assert.match(consent,/localStorage\.setItem\(STORAGE_KEY,value\)/);
});

test('analytics events fail closed until consent is granted',()=>{
  assert.match(analytics,/window\.__aivAnalyticsAllowed!==true/);
  assert.match(analytics,/typeof window\.gtag!=="function"/);
});

test('successful lead conversion sends no direct identity fields to analytics',()=>{
  assert.match(lead,/trackAnalyticsEvent\("generate_lead"/);
  const eventCall=lead.match(/trackAnalyticsEvent\("generate_lead",\{([^}]*)\}\)/s)?.[1]||'';
  assert.match(eventCall,/service:/);
  assert.match(eventCall,/country:/);
  assert.match(eventCall,/language:/);
  for(const forbidden of ['email','phone','name','businessName','website'])assert.ok(!eventCall.includes(forbidden));
});

test('privacy policy documents optional analytics and preference changes',()=>{
  assert.match(privacy,/yalnızca kullanıcı açıkça izin verdiğinde yüklenir/);
  assert.match(privacy,/Çerez tercihleri/);
  assert.match(privacy,/ad, e-posta, telefon veya işletme adı/);
});
