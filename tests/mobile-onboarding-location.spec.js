import {test,expect,devices} from '@playwright/test';

const BASE=process.env.SMOKE_BASE_URL||'http://127.0.0.1:3000';
const iphone=devices['iPhone 13'];

test.use({
  browserName:'chromium',
  viewport:{width:390,height:844},
  userAgent:iphone.userAgent,
  deviceScaleFactor:iphone.deviceScaleFactor,
  isMobile:true,
  hasTouch:true,
});

test('customer onboarding stacks country and city on mobile',async({page,context})=>{
  await context.addCookies([{name:'ai_lang',value:'tr',url:BASE}]);
  await page.goto(`${BASE}/yeni-musteri?service=business-diagnosis&country=T%C3%BCrkiye`,{waitUntil:'networkidle'});
  const country=page.locator('input[list="aiv-country-options"]');
  const city=page.getByLabel('Şehir',{exact:true});
  await expect(country).toBeVisible();
  await expect(city).toBeVisible();
  const boxes=await Promise.all([country.boundingBox(),city.boundingBox()]);
  expect(boxes[0]).not.toBeNull();
  expect(boxes[1]).not.toBeNull();
  expect(boxes[1].y).toBeGreaterThan(boxes[0].y+boxes[0].height);
  const widths=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth}));
  expect(widths.scroll).toBeLessThanOrEqual(widths.viewport+2);
});
