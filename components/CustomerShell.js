"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {LanguageSwitcher,useLanguage} from "./LanguageProvider";
export default function CustomerShell({title,subtitle,children}){
  const {lang,t}=useLanguage();
  const pathname=usePathname();
  function openPortalHome(event){
    if(pathname!=="/musteri-panel"||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    event.preventDefault();
    window.dispatchEvent(new Event("customer-portal-home"));
    window.scrollTo({top:0,left:0,behavior:"smooth"});
  }
  const displayTitle=title==="Müşteri Paneli"?(lang==="en"?"Customer Portal":"Müşteri Paneli"):title;
  const displaySubtitle=subtitle==="AI görünürlüğünüz, çalışmalarınız, rapor süreciniz ve ödemeleriniz."?(lang==="en"?"Your AI visibility, work, reporting process and payments.":subtitle):subtitle;
  async function logout(){await fetch("/api/client-auth/login",{method:"DELETE"});window.location.replace("/musteri-giris");}
  return <main>
    <header className="top">
      <Link href="/musteri-panel" onClick={openPortalHome} className="brand"><span className="logo">A</span><div><strong>AI VISIBILITY</strong><small>{t("customerPanel")}</small></div></Link>
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",justifyContent:"flex-end"}}>
        <Link href="/musteri-panel" onClick={openPortalHome} className="mini-action">{lang==="en"?"Portal Home":"Panel Ana Sayfa"}</Link>
        <Link href="/" className="mini-action">{lang==="en"?"Website Home":"Site Ana Sayfa"}</Link>
        <LanguageSwitcher/>
        <button onClick={logout}>{t("logout")}</button>
      </div>
    </header>
    {displayTitle&&<section className="page-head"><div><h1>{displayTitle}</h1><p>{displaySubtitle}</p></div></section>}
    {children}
  </main>;
}
