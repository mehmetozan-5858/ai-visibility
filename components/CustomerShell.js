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
  function openPortalTab(tab){
    if(pathname!=="/musteri-panel")return;
    window.dispatchEvent(new CustomEvent("customer-portal-tab",{detail:{tab}}));
    window.scrollTo({top:0,left:0,behavior:"smooth"});
  }
  const displayTitle=title==="Müşteri Paneli"?(lang==="en"?"Customer Portal":"Müşteri Paneli"):title;
  const displaySubtitle=subtitle==="AI görünürlüğünüz, çalışmalarınız, rapor süreciniz ve ödemeleriniz."?(lang==="en"?"Your AI visibility, work, reporting process and payments.":subtitle):subtitle;
  async function logout(){await fetch("/api/client-auth/login",{method:"DELETE"});window.location.replace("/musteri-giris");}
  return <main className="customer-shell customer-portal-premium">
    <aside className="customer-side" aria-label={lang==="en"?"Customer portal navigation":"Müşteri paneli menüsü"}>
      <Link href="/musteri-panel" onClick={openPortalHome} className="customer-side-brand"><span>◈</span><div><strong>AI VISIBILITY</strong><small>{lang==="en"?"CUSTOMER PORTAL":"MÜŞTERİ PANELİ"}</small></div></Link>
      <div className="customer-side-status"><span className="customer-status-dot"/>{lang==="en"?"Secure customer area":"Güvenli müşteri alanı"}</div>
      <nav>
        <Link href="/musteri-panel" onClick={openPortalHome} aria-current="page">⌂ {lang==="en"?"Overview":"Genel görünüm"}</Link>
        <button type="button" onClick={()=>openPortalTab("findings")}>◆ {lang==="en"?"Findings & work":"Bulgular ve çalışmalar"}</button>
        <button type="button" onClick={()=>openPortalTab("scans")}>◎ {lang==="en"?"Reports & scans":"Raporlar ve taramalar"}</button>
        <button type="button" onClick={()=>openPortalTab("payments")}>▣ {lang==="en"?"Plan & payments":"Paket ve ödemeler"}</button>
      </nav>
      <div className="customer-side-foot"><Link href="/hizmetler">{lang==="en"?"Services & pricing":"Hizmetler ve fiyatlar"} ↗</Link><Link href="/iletisim">{lang==="en"?"Support":"Destek"} ↗</Link></div>
    </aside>
    <div className="customer-main">
      <header className="customer-topbar">
        <Link href="/musteri-panel" onClick={openPortalHome} className="customer-mobile-brand"><span>◈</span><strong>AI Visibility</strong></Link>
        <div className="customer-top-actions">
          <Link href="/" className="mini-action">{lang==="en"?"Website":"Web sitesi"}</Link>
          <LanguageSwitcher/>
          <button onClick={logout}>{t("logout")}</button>
        </div>
      </header>
      {displayTitle&&<section className="customer-hero"><div><p className="customer-kicker">{lang==="en"?"VISIBILITY WORKSPACE":"VISIBILITY WORKSPACE"}</p><h1>{displayTitle}</h1><p>{displaySubtitle}</p></div><div className="customer-hero-trust"><span>✓ {lang==="en"?"Evidence-linked findings":"Kanıta bağlı bulgular"}</span><span>✓ {lang==="en"?"Verified account access":"Doğrulanmış hesap erişimi"}</span></div></section>}
      <section className="customer-content">{children}</section>
    </div>
  </main>;
}
