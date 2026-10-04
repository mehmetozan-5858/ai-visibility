"use client";
import Link from "next/link";
import {LanguageSwitcher,useLanguage} from "./LanguageProvider";
export default function CustomerShell({title,subtitle,children}){
  const {t}=useLanguage();
  async function logout(){await fetch("/api/client-auth/login",{method:"DELETE"});window.location.href="/musteri-giris";}
  return <main>
    <header className="top">
      <Link href="/musteri-panel" className="brand"><span className="logo">A</span><div><strong>AI VISIBILITY</strong><small>{t("customerPanel")}</small></div></Link>
      <div style={{display:"flex",gap:8,alignItems:"center"}}><LanguageSwitcher/><button onClick={logout}>{t("logout")}</button></div>
    </header>
    {title&&<section className="page-head"><div><h1>{title}</h1><p>{subtitle}</p></div></section>}
    {children}
  </main>;
}
