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
      window.location.replace("/musteri-panel");
    }catch(e){setMsg(e.message)}finally{setBusy(false)}
  }
  return <div style={{minHeight:"100vh",background:"radial-gradient(circle at 20% 10%,rgba(70,234,215,.10),transparent 26%),linear-gradient(180deg,#03121c,#061722)",padding:"24px"}}>
    <div style={{maxWidth:1180,margin:"0 auto"}}>
      <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,padding:"10px 0 34px"}}>
        <Link href="/" style={{display:"flex",alignItems:"center",gap:12,textDecoration:"none",color:"#eef8f8",fontWeight:800,fontSize:19}}><span style={{width:22,height:22,border:"2px solid #48ead9",transform:"rotate(45deg)",display:"inline-block",boxShadow:"0 0 18px rgba(72,234,217,.25)"}}/>AI Visibility</Link>
        <div style={{display:"flex",gap:12,alignItems:"center"}}><LanguageSwitcher/><Link href="/" style={{textDecoration:"none",color:"#9fb5bb",fontSize:13}}>← Ana sayfa</Link></div>
      </header>
      <div className="customer-login-grid" style={{display:"grid",gridTemplateColumns:"minmax(0,1.05fr) minmax(360px,.95fr)",gap:42,alignItems:"center",minHeight:"72vh"}}>
        <section style={{padding:"24px 4px"}}>
          <div style={{fontSize:11,letterSpacing:".22em",fontWeight:900,color:"#54dfd0",textTransform:"uppercase",marginBottom:16}}>Güvenli müşteri alanı</div>
          <h1 style={{fontSize:"clamp(38px,5vw,66px)",lineHeight:1.02,letterSpacing:"-.04em",margin:"0 0 18px",maxWidth:620}}>AI görünürlüğünüzü tek merkezden yönetin.</h1>
          <p style={{color:"#9db1b8",fontSize:17,lineHeight:1.7,maxWidth:600}}>Raporlarınızı, görünürlük skorlarınızı, önerileri ve uygulama sürecinizi güvenli müşteri panelinizden takip edin.</p>
          <div className="customer-login-features" style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:12,marginTop:28,maxWidth:620}}>
            {[['✓','Güvenli giriş'],['72/100','Görünürlük skoru'],['↗','Aksiyon planı']].map(([a,b])=><div key={b} style={{border:"1px solid rgba(75,210,201,.18)",background:"rgba(6,31,42,.72)",borderRadius:16,padding:16}}><strong style={{display:"block",fontSize:20,color:"#55e7d8",marginBottom:6}}>{a}</strong><span style={{fontSize:12,color:"#9ab0b7"}}>{b}</span></div>)}
          </div>
        </section>
        <div style={{maxWidth:460,width:"100%",justifySelf:"end"}}>
          <form className="panel scan-form" onSubmit={submit} style={{padding:26,border:"1px solid rgba(79,220,210,.24)",background:"linear-gradient(160deg,rgba(8,43,54,.96),rgba(5,27,39,.98))",boxShadow:"0 28px 70px rgba(0,0,0,.35)"}}>
            <div><div style={{fontSize:11,color:"#55dfd1",fontWeight:800,letterSpacing:".16em",textTransform:"uppercase"}}>Müşteri paneli</div><h2 style={{fontSize:30,margin:"8px 0 8px"}}>{t("customerLogin")}</h2><p style={{color:"#9eb2b9"}}>{t("customerLoginSubtitle")}</p></div>
            <label>{t("email")}<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required/></label>
            <label>{t("password")}<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required/></label>
            <button disabled={busy} style={{minHeight:46,fontWeight:800}}>{busy?t("signingIn"):t("signIn")}</button>
            <div style={{display:"flex",justifyContent:"space-between",gap:12,fontSize:13,flexWrap:"wrap"}}><Link href="/yeni-musteri">{t("createAccount")}</Link><Link href="/musteri-sifre-sifirla">{t("forgotPassword")}</Link></div>
            {msg&&<p className="client-message">{msg}</p>}
          </form>
          <section className="panel" style={{marginTop:14,padding:18,textAlign:"center",background:"rgba(6,29,39,.75)"}}>
            <b>{t("firstTime")}</b>
            <p style={{margin:"7px 0 12px",color:"#9fb2b8",fontSize:13}}>{t("firstTimeText")}</p>
            <Link href="/demo" style={{fontSize:13}}>{t("viewDemo")} →</Link>
          </section>
        </div>
      </div>
    </div>
    <style jsx>{`@media(max-width:820px){.customer-login-grid{grid-template-columns:1fr!important;gap:12px!important;min-height:auto!important}.customer-login-features{grid-template-columns:1fr!important}}`}</style>
  </div>;
}
