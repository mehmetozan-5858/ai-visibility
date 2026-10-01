"use client";
import {useState} from "react";

const labels={
  database:"Veritabanı",
  dashboard:"Dashboard",
  clients:"Müşteriler",
  scans:"Taramalar",
  crm:"Satış CRM",
  workItems:"İş / Onay",
  payments:"Ödemeler",
  providers:"AI sağlayıcıları",
  auth:"Yönetici koruması",
  paytr:"PayTR"
};

export default function TestCenter(){
  const [busy,setBusy]=useState(false),[data,setData]=useState(null),[msg,setMsg]=useState("");
  async function run(){
    setBusy(true);setMsg("");
    try{
      const r=await fetch("/api/health",{cache:"no-store"});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||"Test merkezi çalıştırılamadı.");
      setData(d);
      setMsg(d.ok?"Ana sistem kontrolleri başarıyla tamamlandı.":"Bir veya daha fazla kontrolde sorun bulundu.");
    }catch(e){setMsg(e.message)}finally{setBusy(false)}
  }
  return <section className="panel">
    <div className="section-title"><div><h2>Test Merkezi</h2><small>Veri değiştirmeden temel sistem kontrollerini çalıştırır</small></div>
      <button onClick={run} disabled={busy}>{busy?"Kontrol ediliyor…":"✓ Tüm kontrolleri çalıştır"}</button>
    </div>
    {msg&&<p className="client-message">{msg}</p>}
    {data&&<div className="client-list">{(data.checks||[]).map(x=>{
      const paytrPending=x.name==="paytr"&&x.ok&&x.detail?.configured===false;
      const authProblem=x.name==="auth"&&x.ok&&x.detail?.configured===false;
      const providerProblem=x.name==="providers"&&x.ok&&Array.isArray(x.detail)&&x.detail.filter(p=>p.status==="connected").length<3;
      const warn=paytrPending||authProblem||providerProblem;
      return <article className="client-row" key={x.name}>
        <div className="client-avatar">{x.ok&&!warn?"✓":x.ok?"!":"×"}</div>
        <div><b>{labels[x.name]||x.name}</b><small>{x.error||(
          paytrPending?"PayTR onayı / anahtarları bekleniyor":
          authProblem?"Yönetici koruması yapılandırılmamış":
          providerProblem?"Bazı AI sağlayıcıları bağlı değil":
          "Kontrol tamamlandı"
        )}</small></div>
        <span className={x.ok&&!warn?"ready":"waiting"}>{x.ok&&!warn?"Sağlıklı":warn?"Bekliyor":"Hata"}</span>
        <em>{x.ms} ms</em>
      </article>
    })}</div>}
  </section>;
}
