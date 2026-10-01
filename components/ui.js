"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import LogoutButton from "./LogoutButton";
export const items=[["/","⌂","Ana Sayfa"],["/musteriler","♙","Müşteriler"],["/taramalar","⌕","Taramalar"],["/raporlar","▥","Raporlar"],["/ajanlar","⌘","Ajanlar"],["/ayarlar","⚙","Ayarlar"]];
export function Nav(){const pathname=usePathname();return <nav className="bottom-nav">{items.map(([href,icon,label])=>{const active=href==="/"?pathname==="/":pathname.startsWith(href);return <a href={href} key={href} className={active?"active":""} aria-current={active?"page":undefined}><b>{icon}</b><span>{label}</span></a>})}</nav>}
export function Shell({title,subtitle,children}){return <main><header className="top"><Link href="/" className="brand"><span className="logo">A</span><div><strong>AI VISIBILITY</strong><small>GEO / AEO YÖNETİM PANELİ</small></div></Link><div style={{display:"flex",gap:8,alignItems:"center"}}><span className="badge">● CANLI / KORUMALI</span><LogoutButton compact/></div></header>{title&&<section className="page-head"><div><h1>{title}</h1><p>{subtitle}</p></div></section>}{children}<Nav/></main>}