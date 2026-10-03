"use client";
import Link from "next/link";
import {useState} from "react";
export default function CustomerLoginForm(){
  const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[busy,setBusy]=useState(false),[msg,setMsg]=useState("");
  async function submit(e){
    e.preventDefault();setBusy(true);setMsg("");
    try{
      const r=await fetch("/api/client-auth/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email,password})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"Giriş yapılamadı.");
      window.location.href="/musteri-panel";
    }catch(e){setMsg(e.message)}finally{setBusy(false)}
  }
  return <div style={{maxWidth:440,margin:"80px auto",padding:"0 16px"}}>
    <form className="panel scan-form" onSubmit={submit}>
      <div><h1 style={{marginBottom:6}}>Müşteri Girişi</h1><p>AI Visibility müşteri paneli</p></div>
      <label>E-posta<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required/></label>
      <label>Şifre<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required/></label>
      <button disabled={busy}>{busy?"Giriş yapılıyor…":"Giriş yap"}</button>
      {msg&&<p className="client-message">{msg}</p>}
    </form>
    <section className="panel" style={{marginTop:14,textAlign:"center"}}>
      <b>İlk kez mi geliyorsunuz?</b>
      <p style={{margin:"8px 0 14px"}}>Yeni müşteriyseniz ödeme ve güvenli hesap oluşturma sürecini buradan başlatın.</p>
      <Link href="/yeni-musteri" style={{display:"inline-block",padding:"11px 16px",borderRadius:10,textDecoration:"none",fontWeight:700}}>Yeni müşteriyim / Hesabımı oluştur</Link>
      <div style={{marginTop:12}}><Link href="/demo">Önce demo panelini incele</Link></div>
    </section>
  </div>;
}
