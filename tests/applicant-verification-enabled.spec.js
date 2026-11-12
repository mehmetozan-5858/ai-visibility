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
  const calls=[];let leadWrites=0;
  await page.route('**/api/**',async route=>{
   const path=new URL(route.request().url()).pathname;
   if(path==='/api/leads'&&route.request().method()==='POST'){leadWrites++;return route.fulfill({json:{ok:true,lead:{id:leadId,status:'new'}}});}
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
  await send.click();await expect(panel.getByRole('status')).toContainText(tr?'Doğrulama şu anda tamamlanamadı.':'Verification could not be completed right now.');
  const code=panel.getByLabel(tr?'6 haneli kod':'6-digit code',{exact:true});
  await expect(code).toHaveCount(0);await send.click();await expect(code).toBeVisible();
  const verify=panel.getByRole('button',{name:tr?'Doğrula':'Verify',exact:true});
  await expect(verify).toBeDisabled();await code.fill('123456');await verify.click();
  await expect(panel.getByRole('status')).toContainText(tr?'Kod geçersiz veya süresi dolmuş.':'The code is invalid or expired.');
  await expect(code).toHaveValue('123456');
  await send.click();await expect(code).toHaveValue('');await expect(verify).toBeDisabled();
  await code.click();await code.pressSequentially('654321');await expect(code).toHaveValue('654321');
  const visual=await code.evaluate(el=>{const s=getComputedStyle(el);return {color:s.color,background:s.backgroundColor,fontSize:parseFloat(s.fontSize),height:el.getBoundingClientRect().height}});
  expect(visual.color).not.toBe(visual.background);expect(visual.fontSize).toBeGreaterThanOrEqual(16);expect(visual.height).toBeGreaterThanOrEqual(44);
  await verify.click();
  await expect(panel.getByText(tr?'E-posta adresiniz doğrulandı.':'Your email address is verified.',{exact:true}).first()).toBeVisible();
  await expect(send).toHaveCount(0);await expect(code).toHaveCount(0);
  expect(calls).toHaveLength(5);
  for(const call of calls)expect(call.body).toMatchObject({leadId,email:'fixture@example.com'});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+2);
  expect(overflow).toBe(false);
  const resume=page.getByRole('link',{name:tr?'Yeni başvuru oluşturmadan e-posta doğrulamasını yeniden aç':'Reopen email verification without another application',exact:true});
  await expect(resume).toHaveAttribute('href','/basvuru-dogrula#lead='+leadId);
  await resume.click();
  const resumeEmail=page.getByLabel(tr?'Başvuru e-postası':'Application email',{exact:true});
  await expect(resumeEmail).toBeVisible();
  expect(new URL(page.url()).hash).toBe('');
  await page.reload();await expect(resumeEmail).toBeVisible();await expect(resumeEmail).toHaveValue('');
  await resumeEmail.fill('fixture@example.com');
  await page.getByRole('button',{name:tr?'Devam et':'Continue',exact:true}).click();
  await expect(send).toBeVisible();await send.click();await expect(code).toBeVisible();
  expect(calls.at(-1).body).toEqual({leadId,email:'fixture@example.com'});
  expect(leadWrites).toBe(1);
 });
}
