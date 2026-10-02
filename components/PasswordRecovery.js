"use client";
import {useEffect,useState} from "react";

export default function PasswordRecovery(){
  const [channels,setChannels]=useState(null),[channel,setChannel]=useState("email"),[requestId,setRequestId]=useState(""),[masked,setMasked]=useState(""),[code,setCode]=useState(""),[password,setPassword]=useState(""),[confirm,setConfirm]=useState(""),[busy,setBusy]=useState(false),[msg,setMsg]=useState("");
  useEffect(()=>{fetch("/api/auth/recovery",{cache:"no-store"}).then(r=>r.json()).then(d=>setChannels(d.channels||{})).catch(()=>setChannels({}))},[]);
  async function sendCode(){
    setBusy(true);setMsg("");
    try{
      const r=await fetch("/api/auth/recovery",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"request",channel})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"Kod gönderilemedi.");
      setRequestId(d.requestId);setMasked(d.masked||"");setMsg("6 haneli doğrulama kodu gönderildi.");
    }catch(e){setMsg(e.message)}finally{setBusy(false)}
  }
  async function resetPassword(e){
    e.preventDefault();setMsg("");
    if(password!==confirm){setMsg("Yeni şifreler eşleşmiyor.");return}
    setBusy(true);
    try{
      const r=await fetch("/api/auth/recovery",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"reset",requestId,code,password})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"Şifre yenilenemedi.");
      setMsg(d.message||"Şifreniz yenilendi.");
      setTimeout(()=>{window.location.href="/login"},1200);
    }catch(e){setMsg(e.message)}finally{setBusy(false)}
  }
  if(!channels)return <section className="panel" style={{maxWidth:480,margin:"80px auto"}}>Kurtarma seçenekleri yükleniyor…</section>;
  const emailOk=channels.email?.configured,phoneOk=channels.phone?.configured;
  return <section className="panel" style={{maxWidth:480,margin:"80px auto"}}>
    <h1>Şifremi unuttum</h1>
    <p>Doğrulama kodunu almak istediğiniz yöntemi seçin.</p>
    {!requestId?<div className="scan-form">
      <label><input type="radio" checked={channel==="email"} onChange={()=>setChannel("email")} disabled={!emailOk}/> E-posta {emailOk&&channels.email?.masked?("· "+channels.email.masked):""}</label>
      <label><input type="radio" checked={channel==="phone"} onChange={()=>setChannel("phone")} disabled={!phoneOk}/> Telefon {phoneOk&&channels.phone?.masked?("· "+channels.phone.masked):""}</label>
      {!emailOk&&!phoneOk&&<div className="empty">Kurtarma kanalları henüz yapılandırılmadı.</div>}
      <button type="button" onClick={sendCode} disabled={busy||(!emailOk&&!phoneOk)||(channel==="email"&&!emailOk)||(channel==="phone"&&!phoneOk)}>{busy?"Gönderiliyor…":"Doğrulama kodu gönder"}</button>
    </div>:<form className="scan-form" onSubmit={resetPassword}>
      <p><b>Kod gönderildi:</b> {masked}</p>
      <label>6 haneli kod<input inputMode="numeric" pattern="[0-9]*" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} required/></label>
      <label>Yeni şifre<input type="password" minLength={10} value={password} onChange={e=>setPassword(e.target.value)} required/></label>
      <label>Yeni şifre tekrar<input type="password" minLength={10} value={confirm} onChange={e=>setConfirm(e.target.value)} required/></label>
      <button disabled={busy||code.length!==6}>{busy?"Yenileniyor…":"Şifreyi yenile"}</button>
      <button type="button" onClick={()=>{setRequestId("");setCode("");setMsg("")}}>Farklı yöntem kullan</button>
    </form>}
    {msg&&<p className="client-message">{msg}</p>}
    <a href="/login" style={{display:"block",textAlign:"center",marginTop:14}}>Giriş ekranına dön</a>
  </section>;
}
