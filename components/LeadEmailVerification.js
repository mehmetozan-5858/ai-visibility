"use client";
import {useState} from "react";
const PUBLIC_ENABLED=process.env.NEXT_PUBLIC_LEAD_EMAIL_VERIFICATION_ENABLED==="true";
const text={
 tr:{title:"E-posta adresinizi doğrulayın",help:"Başvurunuz kaydedildi. Doğrulama, e-posta adresinin size ait olduğunu gösterir; analiz veya ücretli erişim açmaz.",send:"Doğrulama kodu gönder",code:"6 haneli kod",verify:"Doğrula",verified:"E-posta adresiniz doğrulandı.",sent:"Uygunsa e-postanıza bir doğrulama kodu gönderilecektir. En son gelen kodu kullanın; kod 10 dakika geçerlidir.",invalid:"Kod geçersiz veya süresi dolmuş. En son gelen kodu kontrol edin; gerekirse yeni kod isteyin.",error:"Doğrulama şu anda tamamlanamadı. Lütfen tekrar deneyin.",busy:"İşleniyor…"},
 en:{title:"Verify your email address",help:"Your application was saved. Verification confirms access to this inbox; it does not activate an analysis or paid access.",send:"Send verification code",code:"6-digit code",verify:"Verify",verified:"Your email address is verified.",sent:"If eligible, a verification code will be sent to your email. Use the latest code; it is valid for 10 minutes.",invalid:"The code is invalid or expired. Check the latest email or request a new code.",error:"Verification could not be completed right now. Please try again.",busy:"Processing…"}
};
export default function LeadEmailVerification({leadId,email,language="tr"}){
 const c=text[language]||text.tr;
 const [code,setCode]=useState(""),[sent,setSent]=useState(false),[verified,setVerified]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 if(!PUBLIC_ENABLED||!leadId||!email)return null;
 async function submit(path,body){
  setBusy(true);setMessage("");
  try{
   const r=await fetch("/api/lead-email/"+path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body),cache:"no-store"});
   const data=await r.json().catch(()=>({}));
   if(!r.ok)throw Error(path==="verify"&&r.status===400?c.invalid:c.error);
   if(path==="issue"){setCode("");setSent(true);setMessage(c.sent);}
   else if(data.verified===true){setVerified(true);setMessage(c.verified);}
   else throw Error(c.error);
  }catch(err){setMessage([c.invalid,c.error].includes(err.message)?err.message:c.error)}
  finally{setBusy(false)}
 }
 return <section className="panel lead-email-verification" aria-label={c.title} style={{marginTop:16,padding:18}}>
  <h3>{c.title}</h3><p>{c.help}</p>
  {verified?<p role="status">{c.verified}</p>:<>
   <button type="button" onClick={()=>submit("issue",{leadId,email})} disabled={busy}>{busy?c.busy:c.send}</button>
   {sent&&<div style={{marginTop:14}}>
    <label>{c.code}<input type="text" inputMode="numeric" autoComplete="one-time-code" spellCheck={false} pattern="[0-9]{6}" maxLength={6} value={code} disabled={busy} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))}/></label>
    <button type="button" onClick={()=>submit("verify",{leadId,email,code})} disabled={busy||code.length!==6}>{busy?c.busy:c.verify}</button>
   </div>}
  </>}
  {message&&<p role="status" aria-live="polite">{message}</p>}
 </section>;
}
