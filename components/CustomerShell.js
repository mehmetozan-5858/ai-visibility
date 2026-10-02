"use client";
import Link from "next/link";
export default function CustomerShell({title,subtitle,children}){
  async function logout(){
    await fetch("/api/client-auth/login",{method:"DELETE"});
    window.location.href="/musteri-giris";
  }
  return <main>
    <header className="top">
      <Link href="/musteri-panel" className="brand"><span className="logo">A</span><div><strong>AI VISIBILITY</strong><small>MÜŞTERİ PANELİ</small></div></Link>
      <button onClick={logout}>Çıkış</button>
    </header>
    {title&&<section className="page-head"><div><h1>{title}</h1><p>{subtitle}</p></div></section>}
    {children}
  </main>;
}
