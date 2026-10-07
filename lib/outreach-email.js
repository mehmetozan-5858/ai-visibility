import {freeAssessmentUrl} from "./free-assessment-token";
import {safeFirstContact,outreachSubject} from "./outreach-quality";
import {deliverOnce} from "./email-delivery";
function esc(v=""){return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
export function buildBrandedOutreachEmail(x){
 if(x.firstContact){
  const english=!/^(Türkiye|Turkey|TR)$/i.test(String(x.country||""));
  const heading=outreachSubject(x,Boolean(x.followContact));
  const button=x.freeAssessmentUrl?`<p><a href="${esc(x.freeAssessmentUrl)}" style="display:inline-block;background:#117f79;color:white;padding:14px 20px;border-radius:8px;text-decoration:none">${english?"View your free assessment":"Ücretsiz ön değerlendirmenizi görün"}</a></p><p style="font-size:12px">${english?"Score shown only with sufficient evidence. Link valid for 30 days.":"Puan yalnız yeterli veri varsa gösterilir. Bağlantı 30 gün geçerlidir."}</p>`:"";
  return {subject:heading,html:`<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#10202a"><h2>AI Visibility Works</h2><p style="line-height:1.65">${esc(x.outreachDraft).replace(/\n/g,"<br/>")}</p>${button}</div>`};
 }
 const name=esc(x.name),draft=esc(x.outreachDraft).replace(/\n/g,"<br/>"),pkg=esc(x.proposalPackage),amount=esc(x.proposalAmount),currency=esc(x.proposalCurrency);
 const score=Number.isFinite(Number(x.qualificationScore))?Math.max(0,Math.min(100,Number(x.qualificationScore))):"—";
 return {subject:`${x.name} için AI görünürlük mini analizi`,html:`<div style="background:#f3f7f8;padding:24px;font-family:Arial,sans-serif;color:#10202a"><div style="max-width:640px;margin:auto;background:white;border-radius:16px;overflow:hidden;border:1px solid #dce7ea"><div style="padding:22px;background:#102b3a;color:white"><div style="font-size:22px;font-weight:800">AI Visibility Works</div><div style="margin-top:6px;opacity:.85">${name} için AI Görünürlük Mini Analizi</div></div><div style="padding:24px"><div style="display:flex;gap:12px;margin-bottom:20px"><div style="flex:1;padding:14px;border:1px solid #dce7ea;border-radius:12px"><div style="font-size:12px;color:#60727b">Öncelik skoru</div><div style="font-size:28px;font-weight:800">${score}/100</div></div><div style="flex:1;padding:14px;border:1px solid #dce7ea;border-radius:12px"><div style="font-size:12px;color:#60727b">Önerilen çalışma</div><div style="font-weight:800;margin-top:6px">${pkg}</div></div></div><p style="line-height:1.65">${draft}</p><div style="margin-top:20px;padding:16px;background:#f3f7f8;border-radius:12px"><b>Size özel önerilen paket</b><div style="font-size:22px;font-weight:800;margin-top:5px">${amount} ${currency}</div></div><p style="font-size:12px;color:#6d7e86;margin-top:22px">AI Visibility Works · AI görünürlük, GEO/AEO analizi ve uygulama çözümleri</p></div></div></div>`};
}
export async function sendBrandedOutreach(x,{key,finalize}={}){
 const apiKey=process.env.RESEND_API_KEY||"",from=process.env.OUTREACH_EMAIL_FROM||process.env.EMAIL_FROM||process.env.RESEND_FROM_EMAIL||"";
 if(!apiKey||!from)throw new Error("outreach-email-provider-not-configured");
 if(!x.contactEmail)throw new Error("verified-email-required");
 if(!x.firstContact||!safeFirstContact(x))throw Error("evidence-quality-review-required");
 const mail=buildBrandedOutreachEmail({...x,freeAssessmentUrl:freeAssessmentUrl(x.id)});
 if(!key||!finalize)throw Error("delivery-operation-required");
 const delivery=await deliverOnce(key,{from,to:[x.contactEmail],subject:mail.subject,html:mail.html,...(process.env.INBOUND_EMAIL_ADDRESS?{reply_to:process.env.INBOUND_EMAIL_ADDRESS}:{})},finalize);
 return {...delivery,subject:mail.subject};
}
