"use client";
import Link from "next/link";
import BottomNavigation from "./BottomNavigation";
import LogoutButton from "./LogoutButton";
import {LanguageSwitcher,useLanguage} from "./LanguageProvider";
export const items=[["/admin","⌂","home"],["/musteriler","♙","clients"],["/isletme-hesabi","◎","business"],["/taramalar","⌕","scans"],["/raporlar","▥","reports"],["/ajanlar","⌘","agents"],["/ayarlar","⚙","settings"]];
export function Nav(){return <BottomNavigation/>}
export function Shell({title,subtitle,children}){const {t}=useLanguage();return <main><header className="top"><Link href="/admin" className="brand"><span className="logo">A</span><div><strong>AI VISIBILITY</strong><small>{t("adminPanel")}</small></div></Link><div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",justifyContent:"flex-end"}}><LanguageSwitcher/><span className="badge">{t("liveProtected")}</span><LogoutButton compact/></div></header>{title&&<section className="page-head"><div><h1>{title}</h1><p>{subtitle}</p></div></section>}{children}<Nav/></main>}
