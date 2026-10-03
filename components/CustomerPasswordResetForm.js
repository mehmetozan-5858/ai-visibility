"use client";
import Link from "next/link";
import {useState} from "react";

export default function CustomerPasswordResetForm(){
  const [email,setEmail]=useState(""),[code,setCode]=useState(""),[password,setPassword]=useState(""),[sent,setSent]=useState(false),[busy,setBusy]=useState(false),[msg,setMsg]=useState("");
  async function call(action){
    setBusy(true);setMsg("");
    try{
      const r=await fetch("/api/client-auth/password-reset",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action,email,code,password})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"İşlem tamamlanamadı.");
      setMsg(d.message||"İşlem tamamlandı.");
      if(action==="request")setSent(true);
      if(action==="confirm")setTimeout(()=>{window.location.href="/musteri-giris"},900);
    }catch(e){setMsg(e.message)}finally{setBusy(false)}
  }
  return <div style={{maxWidth:440,margin:"80px auto",padding:"0 16px"}}>
    <section className="panel scan-form">
      <div><h1 style={{marginBottom:6}}>Şifremi Unuttum</h1><p>Müşteri hesabınızın e-posta adresine doğrulama kodu gönderelim.</p></div>
      <label>E-posta<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/></label>
      {!sent?<button disabled={busy||!email} onClick={()=>call("request")}>{busy?"Gönderiliyor…":"Doğrulama kodu gönder"}</button>:<>
        <label>6 haneli kod<input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} inputMode="numeric" maxLength={6}/></label>
        <label>Yeni şifre<input type="password" minLength={10} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password"/></label>
        <button disabled={busy||code.length!==6||password.length<10} onClick={()=>call("confirm")}>{busy?"Güncelleniyor…":"Şifremi yenile"}</button>
        <button type="button" disabled={busy} onClick={()=>call("request")} style={{opacity:.8}}>Kodu tekrar gönder</button>
      </>}
      {msg&&<p className="client-message">{msg}</p>}
      <Link href="/musteri-giris">Müşteri girişine dön</Link>
    </section>
  </div>;
}
