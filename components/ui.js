"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import LogoutButton from "./LogoutButton";
import {LanguageSwitcher,useLanguage} from "./LanguageProvider";
export const items=[["/admin","⌂","home"],["/musteriler","♙","clients"],["/isletme-hesabi","◎","business"],["/taramalar","⌕","scans"],["/raporlar","▥","reports"],["/ajanlar","⌘","agents"],["/ayarlar","⚙","settings"]];
export function Nav(){const pathname=usePathname();const {t}=useLanguage();return <nav className="bottom-nav">{items.map(([href,icon,key])=>{const active=href==="/admin"?pathname==="/admin":pathname.startsWith(href);return <a href={href} key={href} className={active?"active":""} aria-current={active?"page":undefined}><b>{icon}</b><span>{t(key)}</span></a>})}</nav>}
export function Shell({title,subtitle,children}){const {t}=useLanguage();return <main><header className="top"><Link href="/admin" className="brand"><span className="logo">A</span><div><strong>AI VISIBILITY</strong><small>{t("adminPanel")}</small></div></Link><div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",justifyContent:"flex-end"}}><LanguageSwitcher/><span className="badge">{t("liveProtected")}</span><LogoutButton compact/></div></header>{title&&<section className="page-head"><div><h1>{title}</h1><p>{subtitle}</p></div></section>}{children}<Nav/></main>}
