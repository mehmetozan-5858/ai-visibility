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
      if(!r.ok)throw new Error(d.error||"Teklif hazırlanamadı.");
      setOffer({client:d.client,...d.offer});
    }catch(e){setMsg(e.message)}finally{setBusy("")}
  }
  return <section className="panel">
    <div className="section-title"><div><h2>Satış Ajanı</h2><small>Düşük görünürlük skoruna göre fırsatları önceliklendirir</small></div></div>
    {rows.length===0?<div className="empty">Henüz satış fırsatı oluşturacak tamamlanmış tarama yok.</div>:
    <div className="client-list">{rows.map(x=><article className="client-row" key={x.id}>
      <div className="client-avatar">₺</div>
      <div><b>{x.name}</b><small>{x.domain||"Web sitesi yok"} · son skor {x.score}/100</small></div>
      <span>{x.score<=30?"Yüksek fırsat":x.score<=55?"Orta fırsat":"Takip"}</span>
      <button onClick={()=>prepare(x.id)} disabled={busy===x.id}>{busy===x.id?"Hazırlanıyor…":"Teklif hazırla"}</button>
    </article>)}</div>}
    {msg&&<p className="client-message">{msg}</p>}
    {offer&&<div className="content-plan">
      <h3>{offer.client.name} · {offer.priority||"fırsat"}</h3>
      <b>Neden şimdi?</b><ul>{(offer.whyNow||[]).map((x,i)=><li key={i}>{x}</li>)}</ul>
      <b>Önerilen paket</b><p>{offer.offer?.name}</p>
      <ul><li>Kurulum: {offer.offer?.setupPriceRange||"Belirlenecek"}</li><li>Aylık: {offer.offer?.monthlyPriceRange||"Belirlenecek"}</li>{(offer.offer?.scope||[]).map((x,i)=><li key={"s"+i}>{x}</li>)}</ul>
      <b>İlk temas taslağı</b><p>{offer.outreachDraft}</p>
      <small>Bu metin otomatik gönderilmez; insan onayı gerekir.</small>
    </div>}
  </section>;
}
