"use client";
import {useState} from "react";
const PUBLIC_ENABLED=process.env.NEXT_PUBLIC_LEAD_EMAIL_VERIFICATION_ENABLED==="true";
const text={
 tr:{title:"E-posta adresinizi doğrulayın",help:"Başvurunuz kaydedildi. Doğrulama, e-posta adresinin size ait olduğunu gösterir; analiz veya ücretli erişim açmaz.",send:"Doğrulama kodu gönder",code:"6 haneli kod",verify:"Doğrula",verified:"E-posta adresiniz doğrulandı.",sent:"Uygunsa e-postanıza bir doğrulama kodu gönderilecektir.",error:"Doğrulama şu anda tamamlanamadı.",busy:"İşleniyor…"},
 en:{title:"Verify your email address",help:"Your application was saved. Verification confirms access to this inbox; it does not activate an analysis or paid access.",send:"Send verification code",code:"6-digit code",verify:"Verify",verified:"Your email address is verified.",sent:"If eligible, a verification code will be sent to your email.",error:"Verification could not be completed right now.",busy:"Processing…"}
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
   if(!r.ok)throw Error(data.error||c.error);
   if(path==="issue"){setSent(true);setMessage(c.sent);}
   else if(data.verified===true){setVerified(true);setMessage(c.verified);}
   else throw Error(c.error);
  }catch(err){setMessage(err.message||c.error)}
  finally{setBusy(false)}
 }
 return <section className="panel" aria-label={c.title} style={{marginTop:16,padding:18}}>
  <h3>{c.title}</h3><p>{c.help}</p>
  {verified?<p role="status">{c.verified}</p>:<>
   <button type="button" onClick={()=>submit("issue",{leadId,email})} disabled={busy}>{busy?c.busy:c.send}</button>
   {sent&&<div style={{marginTop:14}}>
    <label>{c.code}<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))}/></label>
    <button type="button" onClick={()=>submit("verify",{leadId,email,code})} disabled={busy||code.length!==6}>{busy?c.busy:c.verify}</button>
   </div>}
  </>}
  {message&&<p role="status" aria-live="polite">{message}</p>}
 </section>;
}
