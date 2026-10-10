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
  return <div className="customer-login-shell">
    <header className="customer-login-top"><Link href="/" className="customer-login-brand">◈ <span>AI VISIBILITY</span></Link><LanguageSwitcher/></header>
    <div className="customer-login-grid">
      <section className="customer-login-intro">
        <p className="public-kicker">SECURE CLIENT ACCESS</p>
        <h1>{t("customerLogin")}</h1>
        <p>{t("customerLoginSubtitle")}</p>
        <ul><li>Müşteri raporlarınıza tek panelden erişin.</li><li>Tarama ve uygulama durumunu takip edin.</li><li>Hesap işlemlerini doğrulanmış oturum üzerinden yönetin.</li></ul>
      </section>
      <div>
        <form className="panel scan-form customer-login-card" onSubmit={submit}>
          <label>{t("email")}<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required/></label>
          <label>{t("password")}<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required/></label>
          <button disabled={busy}>{busy?t("signingIn"):t("signIn")}</button>
          <div className="customer-login-links"><Link href="/musteri-sifre-sifirla">{t("forgotPassword")}</Link><Link href="/iletisim">Destek</Link></div>
          {msg&&<p className="client-message" role="alert">{msg}</p>}
        </form>
        <section className="panel customer-login-first">
          <b>{t("firstTime")}</b>
          <p>{t("firstTimeText")}</p>
          <Link href="/yeni-musteri" className="customer-login-create">{t("createAccount")}</Link>
          <div><Link href="/demo">{t("viewDemo")}</Link></div>
        </section>
        <p className="customer-login-legal"><Link href="/gizlilik">Gizlilik</Link><span>·</span><Link href="/kvkk">KVKK</Link><span>·</span><Link href="/mesafeli-hizmet-sozlesmesi">Hizmet Sözleşmesi</Link></p>
      </div>
    </div>
  </div>;
}
