"use client";
import {useEffect,useState} from "react";

export default function SalesManager(){
  const [rows,setRows]=useState([]),[busy,setBusy]=useState(""),[offer,setOffer]=useState(null),[msg,setMsg]=useState("");
  async function load(){
    const r=await fetch("/api/sales-agent",{cache:"no-store"});
    const d=await r.json();
    setRows(d.candidates||[]);
  }
  useEffect(()=>{load()},[]);

  async function prepare(id){
    setBusy(id);setMsg("");setOffer(null);
    try{
      const r=await fetch("/api/sales-agent",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({clientId:id})});
      const d=await r.json();
      if(!r.ok)throw new Error([d.error,d.detail].filter(Boolean).join(" · ")||"Teklif hazırlanamadı.");
      setOffer({client:d.client,...d.offer});
    }catch(e){setMsg(e.message)}
    finally{setBusy("")}
  }

  const OfferCard=({o})=><div className="content-plan" style={{margin:"10px 0 16px"}}>
    <h3>{o.client.name} · {o.priority||"fırsat"}</h3>
    {o.fallback&&<small>Standart satış şablonu · AI teklif üretimi kullanılamadığı için skor bazlı hazırlandı.</small>}
    <b>Neden şimdi?</b><ul>{(o.whyNow||[]).map((x,i)=><li key={i}>{x}</li>)}</ul>
    <b>Önerilen paket</b><p>{o.offer?.name||"AI Görünürlük Paketi"}</p>
    <ul>
      <li>Kurulum: {o.offer?.setupPriceRange||"Belirlenecek"}</li>
      <li>Aylık: {o.offer?.monthlyPriceRange||"Belirlenecek"}</li>
      {(o.offer?.scope||[]).map((x,i)=><li key={"s"+i}>{x}</li>)}
    </ul>
    <b>İlk temas taslağı</b><p>{o.outreachDraft}</p>
    <small>Bu metin otomatik gönderilmez; insan onayı gerekir.</small>
  </div>;

  return <section className="panel">
    <div className="section-title"><div><h2>Satış Ajanı</h2><small>Düşük görünürlük skoruna göre fırsatları önceliklendirir</small></div></div>
    {msg&&<p className="client-message">{msg}</p>}
    {rows.length===0?<div className="empty">Henüz satış fırsatı oluşturacak tamamlanmış tarama yok.</div>:
    <div className="client-list">{rows.map(x=><div key={x.id}>
      <article className="client-row">
        <div className="client-avatar">₺</div>
        <div><b>{x.name}</b><small>{x.domain||"Web sitesi yok"} · son skor {x.score}/100</small></div>
        <span>{x.score<=30?"Yüksek fırsat":x.score<=55?"Orta fırsat":"Takip"}</span>
        <button onClick={()=>prepare(x.id)} disabled={busy===x.id}>{busy===x.id?"Hazırlanıyor…":"Teklif hazırla"}</button>
      </article>
      {offer?.client?.id===x.id&&<OfferCard o={offer}/>}
    </div>)}</div>}
  </section>;
}
