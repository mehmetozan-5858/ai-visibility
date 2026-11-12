import {test,expect} from '@playwright/test';

const BASE=process.env.SMOKE_BASE_URL||'http://127.0.0.1:3000';
const enabled=process.env.APPLICANT_VERIFICATION_SMOKE_ENABLED==='true';
const local=['http://127.0.0.1:3000','http://localhost:3000'].includes(BASE);
for(const [language,width] of [['tr',390],['en',390],['en',1440]]){
 test(`enabled applicant verification ${language} ${width}: explicit send, retry and no access grant`,async({page,context})=>{
  test.skip(!enabled||!local,'Requires an explicitly enabled local build with intercepted synthetic requests');
  await page.setViewportSize({width,height:844});
  await context.addCookies([{name:'ai_lang',value:language,url:BASE}]);
  const leadId='11111111-1111-4111-8111-111111111111';
  const calls=[];
  await page.route('**/api/**',async route=>{
   const path=new URL(route.request().url()).pathname;
   if(path==='/api/leads'&&route.request().method()==='POST')return route.fulfill({json:{ok:true,lead:{id:leadId,status:'new'}}});
   if(path==='/api/lead-email/issue'){
    calls.push({path,body:route.request().postDataJSON()});
    return calls.filter(x=>x.path===path).length===1
     ?route.fulfill({status:503,json:{error:'Synthetic delivery unavailable'}})
     :route.fulfill({status:202,json:{ok:true}});
   }
   if(path==='/api/lead-email/verify'){
    const body=route.request().postDataJSON();calls.push({path,body});
    return body.code==='654321'?route.fulfill({json:{ok:true,verified:true}}):route.fulfill({status:400,json:{error:'Synthetic invalid code'}});
   }
   // Never let the fixture create accounts, call providers, or send real emails.
   return route.fulfill({status:503,json:{error:'Blocked synthetic fixture request'}});
  });
  const tr=language==='tr';
  await page.goto(BASE+'/yeni-musteri?country='+encodeURIComponent(tr?'Türkiye':'Germany'),{waitUntil:'networkidle'});
  const panel=page.getByRole('region',{name:tr?'E-posta adresinizi doğrulayın':'Verify your email address'});
  await expect(panel).toHaveCount(0);
  await page.getByLabel(tr?'Ad Soyad':'Full name',{exact:true}).fill('Synthetic Applicant');
  await page.getByLabel(tr?'İşletme adı':'Business name',{exact:true}).fill('Synthetic Business');
  await page.getByRole('combobox',{name:tr?/^Sektör/:/^Industry/}).selectOption('Tekstil / Giyim');
  await page.getByLabel(tr?'E-posta':'Email',{exact:true}).fill('fixture@example.com');
  await page.getByRole('button',{name:tr?'Ön değerlendirme iste':'Request assessment',exact:true}).click();
  await expect(panel).toBeVisible();expect(calls).toHaveLength(0);
  const send=panel.getByRole('button',{name:tr?'Doğrulama kodu gönder':'Send verification code',exact:true});
  await send.click();await expect(panel.getByRole('status')).toContainText('Synthetic delivery unavailable');
  const code=panel.getByLabel(tr?'6 haneli kod':'6-digit code',{exact:true});
  await expect(code).toHaveCount(0);await send.click();await expect(code).toBeVisible();
  const verify=panel.getByRole('button',{name:tr?'Doğrula':'Verify',exact:true});
  await expect(verify).toBeDisabled();await code.fill('123456');await verify.click();
  await expect(panel.getByRole('status')).toContainText('Synthetic invalid code');
  await expect(code).toHaveValue('123456');await code.fill('654321');await verify.click();
  await expect(panel.getByText(tr?'E-posta adresiniz doğrulandı.':'Your email address is verified.',{exact:true}).first()).toBeVisible();
  await expect(send).toHaveCount(0);await expect(code).toHaveCount(0);
  expect(calls).toHaveLength(4);
  for(const call of calls)expect(call.body).toMatchObject({leadId,email:'fixture@example.com'});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+2);
  expect(overflow).toBe(false);
 });
}
