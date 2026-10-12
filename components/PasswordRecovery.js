"use client";
import {useEffect,useState} from "react";

export default function PasswordRecovery(){
  const [channels,setChannels]=useState(null),[emailRequestId,setEmailRequestId]=useState(""),[totpRequestId,setTotpRequestId]=useState("");
  const [emailCode,setEmailCode]=useState(""),[totpCode,setTotpCode]=useState(""),[password,setPassword]=useState(""),[confirm,setConfirm]=useState("");
  const [busy,setBusy]=useState(false),[msg,setMsg]=useState("");
  useEffect(()=>{fetch("/api/auth/recovery",{cache:"no-store"}).then(r=>r.json()).then(d=>setChannels(d.channels||{})).catch(()=>setChannels({}))},[]);

  async function sendCode(channel){
    setBusy(true);setMsg("");
    try{
      const r=await fetch("/api/auth/recovery",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"request",channel,emailRequestId,emailCode,totpCode})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"Kod gönderilemedi.");
      if(channel==="email")setEmailRequestId(d.requestId);else setTotpRequestId(d.requestId);
      setMsg(channel==="email"?"E-posta kodu gönderildi. Şimdi Authenticator kodunu girin.":"Authenticator doğrulandı. Şimdi yeni şifrenizi girin.");
    }catch(e){setMsg(e.message)}finally{setBusy(false)}
  }

  async function resetPassword(e){
    e.preventDefault();setMsg("");
    if(password!==confirm){setMsg("Yeni şifreler eşleşmiyor.");return}
    setBusy(true);
    try{
      const r=await fetch("/api/auth/recovery",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"reset",emailRequestId,totpRequestId,emailCode,totpCode,password})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"Şifre yenilenemedi.");
      setMsg(d.message||"Şifreniz yenilendi.");
      setTimeout(()=>{window.location.href="/login"},1200);
    }catch(e){setMsg(e.message)}finally{setBusy(false)}
  }

  if(!channels)return <section className="panel" style={{maxWidth:480,margin:"80px auto"}}>Kurtarma seçenekleri yükleniyor…</section>;
  const emailOk=channels.email?.configured,totpOk=channels.totp?.configured,ready=emailOk&&totpOk;
  return <section className="panel" style={{maxWidth:480,margin:"80px auto"}}>
    <h1>Yönetici şifre kurtarma</h1>
    <p>Güvenlik için e-posta kodu ve ücretsiz Authenticator uygulaması birlikte zorunludur.</p>
    {!ready?<div className="empty">Çift aşamalı kurtarma henüz tam yapılandırılmadı. E-posta ve Authenticator kurulumu tamamlanmalıdır.</div>:
    <form className="scan-form" onSubmit={resetPassword}>
      <div>
        <b>1. E-posta doğrulaması</b>
        <p>{channels.email?.masked}</p>
        {!emailRequestId?<button type="button" onClick={()=>sendCode("email")} disabled={busy}>{busy?"Gönderiliyor…":"E-posta kodu gönder"}</button>:
        <label>6 haneli e-posta kodu<input inputMode="numeric" pattern="[0-9]*" maxLength={6} value={emailCode} onChange={e=>setEmailCode(e.target.value.replace(/\D/g,"").slice(0,6))} required/></label>}
      </div>
      <div>
        <b>2. Authenticator doğrulaması</b>
        <p>{channels.totp?.masked}</p>
        {!totpRequestId?<><label>6 haneli Authenticator kodu<input inputMode="numeric" pattern="[0-9]*" maxLength={6} value={totpCode} onChange={e=>setTotpCode(e.target.value.replace(/\D/g,"").slice(0,6))} required/></label><button type="button" onClick={()=>sendCode("totp")} disabled={busy||!emailRequestId||emailCode.length!==6||totpCode.length!==6}>{busy?"Gönderiliyor…":"Authenticator kodunu doğrula"}</button></>:<p>Authenticator kodu doğrulandı.</p>}
      </div>
      {emailRequestId&&totpRequestId&&<>
        <label>Yeni şifre<input type="password" minLength={10} value={password} onChange={e=>setPassword(e.target.value)} required/></label>
        <label>Yeni şifre tekrar<input type="password" minLength={10} value={confirm} onChange={e=>setConfirm(e.target.value)} required/></label>
        <button disabled={busy||emailCode.length!==6||totpCode.length!==6}>{busy?"Yenileniyor…":"İki doğrulamayı tamamla ve şifreyi yenile"}</button>
      </>}
    </form>}
    {msg&&<p className="client-message">{msg}</p>}
    <a href="/login" style={{display:"block",textAlign:"center",marginTop:14}}>Giriş ekranına dön</a>
  </section>;
}
