"use client";
import {useEffect,useState} from "react";

export default function LaunchGate(){
  const [data,setData]=useState(null),[error,setError]=useState("");
  async function load(){
    setError("");
    try{
      const r=await fetch("/api/health",{cache:"no-store"});
      const j=await r.json();
      if(!r.ok)throw new Error(j.error||"Lansman kontrolü alınamadı.");
      setData(j);
    }catch(e){setError(e.message)}
  }
  useEffect(()=>{load()},[]);
  if(error)return <section className="panel"><h2>Lansman kontrolü alınamadı</h2><p>{error}</p><button onClick={load}>Tekrar dene</button></section>;
  if(!data)return <section className="panel"><p>Lansman kontrolleri çalıştırılıyor…</p></section>;
  const launch=data.launch||{ready:false,passed:0,total:0,gates:[]};
  return <div className="launch-gate">
    <section className={`launch-status ${launch.ready?"is-ready":"is-blocked"}`}>
      <div>
        <span className="admin-page-kicker">LAUNCH GATE</span>
        <h2>{launch.ready?"Lansman için teknik kapılar açık":"Lansmanı engelleyen teknik maddeler var"}</h2>
        <p>{launch.passed}/{launch.total} zorunlu kontrol başarılı. Son kontrol: {new Date(data.checkedAt).toLocaleString("tr-TR")}</p>
      </div>
      <div className="launch-score"><strong>{launch.passed}</strong><span>/ {launch.total}</span></div>
    </section>

    <section className="launch-grid">
      {launch.gates.map(g=><article className="panel launch-card" key={g.id}>
        <div className="launch-card-top"><span className={g.ok?"launch-ok":"launch-bad"}>{g.ok?"✓":"!"}</span><small>{g.required?"ZORUNLU":"OPSİYONEL"}</small></div>
        <h3>{g.label}</h3>
        <p>{typeof g.detail==="string"?g.detail:g.detail?Object.entries(g.detail).filter(([,v])=>v).map(([k])=>k).join(" · ")||"Hazır değil":g.ok?"Hazır":"Hazır değil"}</p>
      </article>)}
    </section>

    <section className="panel launch-notes">
      <h2>Yayın kararı</h2>
      <p>Bu ekran yalnız teknik hazırlığı doğrular. Production yayını; alan adı, ödeme, yasal metinler, müşteri akışı ve yönetici operasyonu birlikte kontrol edildikten sonra yapılmalıdır.</p>
      <div className="launch-actions"><button onClick={load}>Kontrolleri yenile</button><a href="/hizmetler" target="_blank" rel="noreferrer">Hizmetleri aç ↗</a><a href="/musteri-giris" target="_blank" rel="noreferrer">Müşteri girişini aç ↗</a></div>
    </section>
  </div>;
}
