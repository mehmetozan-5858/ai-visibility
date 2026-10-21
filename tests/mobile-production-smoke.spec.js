import { test, expect, devices } from '@playwright/test';
import ecosystem from '../lib/ecosystem-contract.cjs';
import {createClientToken,createAdminToken} from '../lib/admin-auth.js';

const BASE = process.env.SMOKE_BASE_URL || 'https://www.aivisibilityworks.com';
const routes = ['/', '/musteri-giris', '/yeni-musteri', '/hizmetler', '/demo', '/metodoloji', '/yapay-zeka-gorunurlugu'];
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
  await page.getByLabel('Full name',{exact:true}).fill('Local Test Customer');
  await page.waitForTimeout(500);
  await expect(page.getByRole('textbox',{name:'Business name',exact:true})).toBeVisible();
  await expect(page.getByRole('option',{name:'Other',exact:true})).toHaveAttribute('value','Diğer');
  await expect(page.getByRole('combobox',{name:/^Selected software plan/})).toHaveValue('business-monitoring');
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
    return route.fulfill({json:{leads:[{id:'fixture',businessName:'Regional lead fixture',name:'Synthetic fixture',email:'fixture@example.com',website:'https://long-regional-fixture-domain.test.ai-visibility.local',country:'Germany',requestedService:'business-monitoring',status:'new',service:{name:'İşletme – Sürekli Takip + Optimizasyon',amount:159,currency:'EUR',kind:'monthly'}}]}});
  });
  await page.goto(`${BASE}/musteriler`,{waitUntil:'networkidle'});
  await expect(page.getByRole('heading',{name:'Yeni Müşteri Başvuruları',exact:true})).toBeVisible();
  await expect(page.getByText('Henüz yeni müşteri başvurusu yok.',{exact:true})).not.toBeVisible();
  await page.getByRole('button',{name:'Başvuruları yeniden yükle',exact:true}).click();
  const lead=page.locator('.client-row').filter({hasText:'Regional lead fixture'});
  await expect(lead).toContainText('€159 / ay');
  await expect(lead.getByRole('button',{name:'Müşteri + ödeme',exact:true})).toBeVisible();
  const widths=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth}));
  expect(widths.scroll).toBeLessThanOrEqual(widths.viewport+2);
});

test('local customer recovery preserves errors and resets verification when the email changes',async({page,context})=>{
  test.skip(!['http://127.0.0.1:3000','http://localhost:3000'].includes(BASE),'local intercepted fixture only');
  await context.addCookies([{name:'ai_lang',value:'tr',url:BASE}]);
  let confirmations=0;
  await page.route('**/api/client-auth/password-reset',route=>{
    const body=route.request().postDataJSON();
    if(body.action==='request')return route.fulfill({json:{ok:true,message:'Bu e-posta ile kayıtlı hesap varsa doğrulama kodu gönderildi.'}});
    if(++confirmations===1)return route.fulfill({status:500,json:{error:'Şifre sıfırlama işlemi tamamlanamadı.'}});
    return route.fulfill({json:{ok:true,message:'Şifreniz yenilendi. Artık giriş yapabilirsiniz.'}});
  });
  await page.goto(`${BASE}/musteri-sifre-sifirla`,{waitUntil:'networkidle'});
  const form=page.locator('.customer-password-reset');
  await form.getByLabel('E-posta',{exact:true}).fill('fixture@example.com');
  await form.getByRole('button',{name:'Doğrulama kodu gönder',exact:true}).click();
  await form.getByLabel('6 haneli kod',{exact:true}).fill('123456');
  await form.getByLabel('Yeni şifre',{exact:true}).fill('local-fixture-password');
  await form.getByRole('button',{name:'Şifremi yenile',exact:true}).click();
  await expect(form.getByRole('status')).toHaveText('Şifre sıfırlama işlemi tamamlanamadı.');
  await expect(page).toHaveURL(/\/musteri-sifre-sifirla$/);
  await form.getByLabel('E-posta',{exact:true}).fill('other-fixture@example.com');
  await expect(form.getByLabel('6 haneli kod',{exact:true})).not.toBeVisible();
  await form.getByRole('button',{name:'Doğrulama kodu gönder',exact:true}).click();
  await form.getByLabel('6 haneli kod',{exact:true}).fill('123456');
  await form.getByLabel('Yeni şifre',{exact:true}).fill('local-fixture-password');
  await form.getByRole('button',{name:'Şifremi yenile',exact:true}).click();
  await expect(page).toHaveURL(/\/musteri-giris$/);
});


test('local ecosystem uses the selected saved business without leaking account fields',async({page,context})=>{
  test.skip(!['http://127.0.0.1:3000','http://localhost:3000'].includes(BASE),'local fixture only');
  await context.addCookies([{name:'ai_admin',value:await createAdminToken(),url:BASE,httpOnly:true,sameSite:'Strict'},{name:'ai_client',value:await createClientToken('eco-a'),url:BASE,httpOnly:true,sameSite:'Strict'},{name:'ai_lang',value:'tr',url:BASE}]);
  const clients=[{id:'eco-a',name:'Ecosystem A',domain:'example.com',profile:{country:'Germany',sector:'B2B / Sanayi',phone:'PRIVATE_SENTINEL'}},{id:'eco-b',name:'Ecosystem B',domain:'example.org',profile:{country:'Türkiye',sector:'Tekstil / Giyim'}}];
  const account=client=>({client,profile:client.profile,scans:[],payments:[],activity:[],workItems:[],access:{kind:'pilot',expiresAt:'2030-01-01'}});
  let writes=0;
  await page.route('**/api/**',route=>{
    if(!['GET','HEAD'].includes(route.request().method())){writes++;return route.abort();}
    const url=new URL(route.request().url());
    if(url.pathname==='/api/clients')return route.fulfill({json:{clients}});
    if(url.pathname==='/api/client-activity')return route.fulfill({json:{account:account(clients.find(c=>c.id===url.searchParams.get('clientId')))}});
    if(url.pathname==='/api/client-portal')return route.fulfill({json:{account:account(clients[0])}});
    if(url.pathname==='/api/client-portal/solutions')return route.fulfill({json:{findings:[]}});
    return route.fulfill({json:{}});
  });
  for(const width of [390,1280]){
    await page.setViewportSize({width,height:900});
    await page.goto(`${BASE}/isletme-hesabi`,{waitUntil:'networkidle'});
    const navigation=page.getByRole('navigation',{name:'Ekosistem geçişleri'});
    await expect(navigation.getByRole('link',{name:'Global Broker'})).toHaveAttribute('href',ecosystem.links.brokerAdmin);
    const transfer=page.getByRole('region',{name:'Firma profili aktarımı'});
    await expect(transfer).toContainText('Ecosystem A');
    await page.getByRole('combobox',{name:'İşletme',exact:true}).selectOption('eco-b');
    await expect(transfer).toContainText('Ecosystem B');
    const data=ecosystem.parse(new URL(await transfer.getByRole('link').getAttribute('href')).hash);
    expect(data.business).toEqual({businessName:'Ecosystem B',website:'https://example.org/',country:'Türkiye',sector:'Tekstil / Giyim'});
    await page.goto(`${BASE}/musteri-panel`,{waitUntil:'networkidle'});
    await expect(page.getByRole('navigation',{name:'Ekosistem geçişleri'}).getByRole('link',{name:'Global Broker'})).toHaveAttribute('href',ecosystem.links.brokerPortal);
    await expect(transfer).toContainText('Ecosystem A');
    const href=await transfer.getByRole('link').getAttribute('href');
    expect(href).not.toContain('PRIVATE_SENTINEL');
    expect(ecosystem.parse(new URL(href).hash).business.businessName).toBe('Ecosystem A');
    const widths=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth}));
    expect(widths.scroll).toBeLessThanOrEqual(widths.viewport+2);
  }
  expect(writes).toBe(0);
});
