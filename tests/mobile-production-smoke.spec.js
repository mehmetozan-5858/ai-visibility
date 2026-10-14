import { test, expect, devices } from '@playwright/test';
import {createAdminToken} from '../lib/admin-auth.js';

const BASE = process.env.SMOKE_BASE_URL || 'https://www.aivisibilityworks.com';
const routes = ['/', '/musteri-giris', '/yeni-musteri', '/hizmetler', '/demo'];
const iphone = devices['iPhone 13'];

test.use({
  browserName: 'chromium',
  viewport: { width: 390, height: 844 },
  userAgent: iphone.userAgent,
  deviceScaleFactor: iphone.deviceScaleFactor,
  isMobile: true,
  hasTouch: true,
});

for (const route of routes) {
  test(`mobile smoke ${route}`, async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    const response = await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
    expect(response, `missing main document response for ${route}`).not.toBeNull();
    expect(response.status(), `${route} returned HTTP ${response.status()}`).toBeLessThan(400);

    await expect(page.locator('body')).toBeVisible();
    const title = await page.title();
    expect(title.trim().length, `${route} has an empty title`).toBeGreaterThan(0);

    const overflow = await page.evaluate(() => {
      const clientWidth = document.documentElement.clientWidth;
      const offenders = [...document.querySelectorAll('body *')]
        .map((el) => {
          const r = el.getBoundingClientRect();
          return {
            tag: el.tagName.toLowerCase(),
            className: typeof el.className === 'string' ? el.className : '',
            left: Math.round(r.left),
            right: Math.round(r.right),
            width: Math.round(r.width),
            text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 90),
          };
        })
        .filter((x) => x.right > clientWidth + 2 || x.left < -2)
        .slice(0, 20);
      return { scrollWidth: document.documentElement.scrollWidth, clientWidth, offenders };
    });
    if (overflow.scrollWidth > overflow.clientWidth + 2) {
      console.log(`OVERFLOW ${route}: ${JSON.stringify(overflow.offenders)}`);
    }
    expect(
      overflow.scrollWidth,
      `${route} horizontally overflows: ${overflow.scrollWidth}px > ${overflow.clientWidth}px; offenders=${JSON.stringify(overflow.offenders)}`,
    ).toBeLessThanOrEqual(overflow.clientWidth + 2);

    await page.waitForTimeout(500);
    expect(consoleErrors, `${route} emitted browser console errors`).toEqual([]);
  });
}

test('local onboarding retains selected service and retries a failed submission',async({page,context})=>{
  test.skip(!['http://127.0.0.1:3000','http://localhost:3000'].includes(BASE),'local fixture only; no real lead writes');
  await context.addCookies([{name:'ai_lang',value:'tr',url:BASE}]);
  const submitted=[];
  await page.route('**/api/leads',async route=>{
    submitted.push(route.request().postDataJSON());
    if(submitted.length===1)return route.fulfill({status:503,contentType:'text/html',body:'Temporary gateway failure'});
    if(submitted.length===2)return route.fulfill({status:200,json:{ok:false}});
    return route.fulfill({json:{ok:true,lead:{id:'local-fixture',status:'new'}}});
  });
  await page.goto(`${BASE}/yeni-musteri?service=business-monitoring&country=Germany`,{waitUntil:'networkidle'});
  // Reproduce the owner browser's Turkish preference while this page explicitly
  // uses English. Let the legacy DOM translator run before asserting labels.
  await page.getByLabel('Full name',{exact:true}).fill('Local Test Customer');
  await page.waitForTimeout(500);
  await expect(page.getByRole('textbox',{name:'Business name',exact:true})).toBeVisible();
  await expect(page.getByRole('option',{name:'Other',exact:true})).toHaveAttribute('value','Diğer');
  await expect(page.getByRole('combobox',{name:/^Selected service/})).toHaveValue('business-monitoring');
  await page.getByLabel('Full name',{exact:true}).fill('Local Test Customer');
  await page.getByLabel('Business name',{exact:true}).fill('Local Fixture Business');
  await page.getByRole('combobox',{name:/^Industry/}).selectOption('Tekstil / Giyim');
  await page.getByLabel('Email',{exact:true}).fill('fixture@example.com');
  const form=page.locator('form.scan-form');
  const send=page.getByRole('button',{name:'Request assessment',exact:true});
  await send.click();
  await expect(form.getByRole('alert')).toHaveText('Could not submit your application.');
  await expect(send).toBeEnabled();
  await send.click();
  await expect(form.getByRole('alert')).toHaveText('Could not submit your application.');
  await expect(send).toBeEnabled();
  await send.click();
  await expect(form.getByRole('status')).toContainText('Your application has been received.');
  await expect(page.getByRole('button',{name:'Application received ✓',exact:true})).toBeDisabled();
  expect(submitted).toHaveLength(3);
  for(const body of submitted)expect(body).toMatchObject({service:'business-monitoring',country:'Germany',language:'en',email:'fixture@example.com'});
  const widths=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth}));
  expect(widths.scroll).toBeLessThanOrEqual(widths.viewport+2);
});

test('authenticated local settings and verification controls fit mobile width',async({page,context})=>{
  // Never issue a fixture token or mock customer actions against an external site.
  test.skip(!['http://127.0.0.1:3000','http://localhost:3000'].includes(BASE),'local build fixture only');
  await context.addCookies([{name:'ai_admin',value:await createAdminToken(),url:BASE,httpOnly:true,sameSite:'Strict'}]);
  await page.route('**/api/status',route=>route.fulfill({json:{database:{configured:true},providers:[],auth:{configured:true,recovery:{}},billing:{configured:false},integrations:{cms:{configured:false,missing:['WORDPRESS_SITE_URL','WORDPRESS_USERNAME','WORDPRESS_APPLICATION_PASSWORD']}}}}));
  await page.route('**/api/admin-test-flow',route=>route.fulfill({json:{ok:true,emailMasked:'fi***@example.com'}}));
  await page.goto(`${BASE}/ayarlar`,{waitUntil:'networkidle'});
  await expect(page.getByText('WORDPRESS_APPLICATION_PASSWORD',{exact:false})).toBeVisible();
  await expect(page.getByRole('link',{name:'Ücretsiz kurulum →',exact:true})).toHaveAttribute('href','/admin/guvenlik');
  await page.getByRole('button',{name:'5. aşama testini başlat',exact:true}).click();
  const input=page.getByLabel('E-postaya gelen 6 haneli kod',{exact:true});
  await expect(input).toBeVisible();
  const size=await page.evaluate(()=>{
    const input=document.querySelector('.test-center input');
    const r=input.getBoundingClientRect(),p=input.closest('.panel').getBoundingClientRect();
    return {scroll:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth,right:r.right,cardRight:p.right};
  });
  expect(size.scroll).toBeLessThanOrEqual(size.viewport+2);
  expect(size.right).toBeLessThanOrEqual(size.cardRight);
  await expect(page.getByRole('button',{name:'Kodu doğrula ve 5. aşamayı bitir',exact:true})).toBeDisabled();
});

test('local admin sees regional assessment leads and can retry an unavailable list',async({page,context})=>{
  test.skip(!['http://127.0.0.1:3000','http://localhost:3000'].includes(BASE),'local fixture only');
  await context.addCookies([{name:'ai_admin',value:await createAdminToken(),url:BASE,httpOnly:true,sameSite:'Strict'},{name:'ai_lang',value:'tr',url:BASE}]);
  await page.route('**/api/clients',route=>route.fulfill({json:{clients:[]}}));
  await page.route('**/api/prospects',route=>route.fulfill({json:{prospects:[]}}));
  let requests=0;
  await page.route('**/api/leads',route=>{
    if(++requests===1)return route.fulfill({status:503,json:{error:'Başvurular yüklenemedi.'}});
    return route.fulfill({json:{leads:[{id:'fixture',businessName:'Regional lead fixture',name:'Synthetic fixture',email:'fixture@example.com',country:'Germany',requestedService:'business-monitoring',status:'new',service:{name:'İşletme – Sürekli Takip + Optimizasyon',amount:159,currency:'EUR',kind:'monthly'}}]}});
  });
  await page.goto(`${BASE}/musteriler`,{waitUntil:'networkidle'});
  await expect(page.getByRole('heading',{name:'Yeni Müşteri Başvuruları',exact:true})).toBeVisible();
  await expect(page.getByText('Henüz yeni müşteri başvurusu yok.',{exact:true})).not.toBeVisible();
  await page.getByRole('button',{name:'Başvuruları yeniden yükle',exact:true}).click();
  const lead=page.locator('.client-row').filter({hasText:'Regional lead fixture'});
  await expect(lead).toContainText('159,00');await expect(lead).toContainText('€');
  await expect(lead.getByRole('button',{name:'Müşteri + ödeme',exact:true})).toBeVisible();
  const widths=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth}));
  expect(widths.scroll).toBeLessThanOrEqual(widths.viewport+2);
});
