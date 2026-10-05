"use client";
import {useEffect,useState} from "react";

export default function PasswordRecovery(){
  const [channels,setChannels]=useState(null),[emailRequestId,setEmailRequestId]=useState(""),[phoneRequestId,setPhoneRequestId]=useState("");
  const [emailCode,setEmailCode]=useState(""),[phoneCode,setPhoneCode]=useState(""),[password,setPassword]=useState(""),[confirm,setConfirm]=useState("");
  const [busy,setBusy]=useState(false),[msg,setMsg]=useState("");
  useEffect(()=>{fetch("/api/auth/recovery",{cache:"no-store"}).then(r=>r.json()).then(d=>setChannels(d.channels||{})).catch(()=>setChannels({}))},[]);

  async function sendCode(channel){
    setBusy(true);setMsg("");
    try{
      const r=await fetch("/api/auth/recovery",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"request",channel})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"Kod gönderilemedi.");
      if(channel==="email")setEmailRequestId(d.requestId);else setPhoneRequestId(d.requestId);
      setMsg(channel==="email"?"E-posta kodu gönderildi. Şimdi SMS kodunu isteyin.":"SMS kodu gönderildi. İki kodu girerek şifrenizi yenileyin.");
    }catch(e){setMsg(e.message)}finally{setBusy(false)}
  }

  async function resetPassword(e){
    e.preventDefault();setMsg("");
    if(password!==confirm){setMsg("Yeni şifreler eşleşmiyor.");return}
    setBusy(true);
    try{
      const r=await fetch("/api/auth/recovery",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"reset",emailRequestId,phoneRequestId,emailCode,phoneCode,password})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"Şifre yenilenemedi.");
      setMsg(d.message||"Şifreniz yenilendi.");
      setTimeout(()=>{window.location.href="/login"},1200);
    }catch(e){setMsg(e.message)}finally{setBusy(false)}
  }

  if(!channels)return <section className="panel" style={{maxWidth:480,margin:"80px auto"}}>Kurtarma seçenekleri yükleniyor…</section>;
  const emailOk=channels.email?.configured,phoneOk=channels.phone?.configured,ready=emailOk&&phoneOk;
  return <section className="panel" style={{maxWidth:480,margin:"80px auto"}}>
    <h1>Yönetici şifre kurtarma</h1>
    <p>Güvenlik için e-posta ve telefon doğrulamasının ikisi de zorunludur.</p>
    {!ready?<div className="empty">Çift aşamalı kurtarma henüz tam yapılandırılmadı. E-posta ve SMS servislerinin ikisi de etkin olmalıdır.</div>:
    <form className="scan-form" onSubmit={resetPassword}>
      <div>
        <b>1. E-posta doğrulaması</b>
        <p>{channels.email?.masked}</p>
        {!emailRequestId?<button type="button" onClick={()=>sendCode("email")} disabled={busy}>{busy?"Gönderiliyor…":"E-posta kodu gönder"}</button>:
        <label>6 haneli e-posta kodu<input inputMode="numeric" pattern="[0-9]*" maxLength={6} value={emailCode} onChange={e=>setEmailCode(e.target.value.replace(/\D/g,"").slice(0,6))} required/></label>}
      </div>
      <div>
        <b>2. Telefon doğrulaması</b>
        <p>{channels.phone?.masked}</p>
        {!phoneRequestId?<button type="button" onClick={()=>sendCode("phone")} disabled={busy||!emailRequestId}>{busy?"Gönderiliyor…":"SMS kodu gönder"}</button>:
        <label>6 haneli SMS kodu<input inputMode="numeric" pattern="[0-9]*" maxLength={6} value={phoneCode} onChange={e=>setPhoneCode(e.target.value.replace(/\D/g,"").slice(0,6))} required/></label>}
      </div>
      {emailRequestId&&phoneRequestId&&<>
        <label>Yeni şifre<input type="password" minLength={10} value={password} onChange={e=>setPassword(e.target.value)} required/></label>
        <label>Yeni şifre tekrar<input type="password" minLength={10} value={confirm} onChange={e=>setConfirm(e.target.value)} required/></label>
        <button disabled={busy||emailCode.length!==6||phoneCode.length!==6}>{busy?"Yenileniyor…":"İki kodu doğrula ve şifreyi yenile"}</button>
      </>}
    </form>}
    {msg&&<p className="client-message">{msg}</p>}
    <a href="/login" style={{display:"block",textAlign:"center",marginTop:14}}>Giriş ekranına dön</a>
  </section>;
}
