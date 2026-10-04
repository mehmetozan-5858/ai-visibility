"use client";
import Link from "next/link";
import {useState} from "react";
import {LanguageSwitcher,useLanguage} from "./LanguageProvider";
export default function CustomerLoginForm(){
  const {t}=useLanguage();
  const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[busy,setBusy]=useState(false),[msg,setMsg]=useState("");
  async function submit(e){
    e.preventDefault();setBusy(true);setMsg("");
    try{
      const r=await fetch("/api/client-auth/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email,password})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||t("loginFailed"));
      window.location.href="/musteri-panel";
    }catch(e){setMsg(e.message)}finally{setBusy(false)}
  }
  return <div style={{maxWidth:440,margin:"80px auto",padding:"0 16px"}}>
    <div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}><LanguageSwitcher/></div>
    <form className="panel scan-form" onSubmit={submit}>
      <div><h1 style={{marginBottom:6}}>{t("customerLogin")}</h1><p>{t("customerLoginSubtitle")}</p></div>
      <label>{t("email")}<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required/></label>
      <label>{t("password")}<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required/></label>
      <button disabled={busy}>{busy?t("signingIn"):t("signIn")}</button>
      <div style={{textAlign:"right"}}><Link href="/musteri-sifre-sifirla">{t("forgotPassword")}</Link></div>
      {msg&&<p className="client-message">{msg}</p>}
    </form>
    <section className="panel" style={{marginTop:14,textAlign:"center"}}>
      <b>{t("firstTime")}</b>
      <p style={{margin:"8px 0 14px"}}>{t("firstTimeText")}</p>
      <Link href="/yeni-musteri" style={{display:"inline-block",padding:"11px 16px",borderRadius:10,textDecoration:"none",fontWeight:700}}>{t("createAccount")}</Link>
      <div style={{marginTop:12}}><Link href="/demo">{t("viewDemo")}</Link></div>
    </section>
  </div>;
}
