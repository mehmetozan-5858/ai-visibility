import {chromium} from "@playwright/test";

const base=process.env.SMOKE_BASE_URL||"http://127.0.0.1:3000";
const browser=await chromium.launch({headless:true});
try{
 for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:820}});
  const errors=[];
  page.on("pageerror",error=>errors.push(String(error.message).slice(0,180)));
  const main=await page.goto(base+"/yeni-musteri",{waitUntil:"domcontentloaded",timeout:30000});
  if(main?.status()!==200)throw Error("Application page failed HTTP "+main?.status());
  await page.getByText(/Ücretsiz ön değerlendirme başlat|Start a free assessment/).first().waitFor();
  if(errors.length)throw Error("Application page JS exception: "+errors.join("|"));
  const preview=await page.goto(base+"/basvuru-analiz",{waitUntil:"domcontentloaded",timeout:30000});
  if(preview?.status()!==200)throw Error("Preview page failed HTTP "+preview?.status());
  await page.getByText(/Güvenli analiz bağlantısı gerekli|A secure assessment link is required/).first().waitFor();
  if(errors.length)throw Error("Browser JS exception: "+errors.join("|"));
  console.log("Customer journey browser smoke PASS viewport="+width);
  await page.close();
 }
}finally{await browser.close();}
