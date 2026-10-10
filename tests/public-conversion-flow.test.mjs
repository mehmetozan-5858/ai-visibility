import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("public conversion section has bilingual transparent steps and actual onboarding links",()=>{
 const page=read("app/site-preview/page.jsx");
 for(const text of ["İlk başvurudan ölçülebilir aksiyona","From first request to a measurable action plan","nextStepsTitle","nextStepsNote","Başvuru ücretsizdir","Submitting an application is free"])assert.ok(page.includes(text),text);
 assert.match(page,/href="\/yeni-musteri\?service=business-diagnosis"/);
 assert.match(page,/href="\/hizmetler"/);
 assert.match(page,/href="\/iletisim"/);
 assert.match(page,/nextSteps\.map/);
});
test("conversion path is mobile responsive and real onboarding remains functional",()=>{
 const css=read("app/site-preview/premium-visual.css");
 for(const selector of [".next-step-grid",".next-step-card",".next-step-actions",".next-step-pricing"])assert.ok(css.includes(selector),selector);
 assert.match(css,/@media\(max-width:700px\)/);
 const form=read("components/NewCustomerLeadForm.js");
 assert.match(form,/fetch\("\/api\/leads"/);
 assert.match(form,/initialService/);
 const page=read("app/yeni-musteri/page.js");
 assert.match(page,/NewCustomerLeadForm/);
});
