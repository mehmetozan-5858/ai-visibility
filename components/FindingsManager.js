"use client";
import {useEffect,useMemo,useState} from "react";

const sev={critical:"Kritik",high:"Yüksek",medium:"Orta",low:"Düşük"};
const statusLabel={open:"Açık",offered:"Teklif",approved:"Onaylandı","in-progress":"Uygulanıyor",resolved:"Çözüldü",dismissed:"Kapatıldı"};

export default function FindingsManager(){
  const [items,setItems]=useState([]),[clients,setClients]=useState([]),[clientId,setClientId]=useState(""),[busy,setBusy]=useState(""),[msg,setMsg]=useState("");
  async function load(){
    const [f,c]=await Promise.all([fetch("/api/findings",{cache:"no-store"}).then(r=>r.json()),fetch("/api/clients",{cache:"no-store"}).then(r=>r.json())]);
    setItems(f.findings||[]);setClients(c.clients||[]);if(!clientId&&c.clients?.[0]?.id)setClientId(c.clients[0].id);
  }
  useEffect(()=>{load()},[]);
  async function generate(){
    if(!clientId)return;setBusy("generate");setMsg("");
    try{const r=await fetch("/api/findings",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({clientId})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Üretilemedi.");setMsg(`${d.count||0} bulgu eşleştirildi.`);await load()}catch(e){setMsg(e.message)}finally{setBusy("")}
  }
  async function save(x,patch){
    setBusy(x.id);setMsg("");
    try{const r=await fetch("/api/findings",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({findingId:x.id,offerId:x.offerId,...patch})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Güncellenemedi.");await load()}catch(e){setMsg(e.message)}finally{setBusy("")}
  }
  const counts=useMemo(()=>({critical:items.filter(x=>x.severity==="critical").length,high:items.filter(x=>x.severity==="high").length,open:items.filter(x=>!['resolved','dismissed'].includes(x.status)).length}),[items]);
  return <section className="panel">
    <div className="section-title"><div><h2>Bulgu → Çözüm Merkezi</h2><small>Tarama sonuçlarını satılabilir ve uygulanabilir çözüm paketlerine dönüştürür.</small></div></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:10,marginBottom:14}}><div className="content-plan"><small>Açık</small><h2>{counts.open}</h2></div><div className="content-plan"><small>Kritik</small><h2>{counts.critical}</h2></div><div className="content-plan"><small>Yüksek</small><h2>{counts.high}</h2></div></div>
    <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"end",marginBottom:14}}>
      <label style={{minWidth:240}}>Müşteri<select value={clientId} onChange={e=>setClientId(e.target.value)}>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <button onClick={generate} disabled={!clientId||busy==="generate"}>{busy==="generate"?"Üretiliyor…":"✦ Son taramadan bulguları üret"}</button>
    </div>
    {msg&&<p className="client-message">{msg}</p>}
    {!items.length?<div className="empty">Henüz bulgu yok. Bir müşteriyi seçip son taramadan bulguları üretin.</div>:<div className="client-list">{items.map(x=><article className="client-row" key={x.id} style={{alignItems:"flex-start"}}>
      <div className="client-avatar">{x.severity==="critical"?"!":"✦"}</div>
      <div style={{minWidth:0,flex:1}}><b>{x.clientName} · {x.title}</b><small>{x.provider} · {sev[x.severity]||x.severity} · {statusLabel[x.status]||x.status}</small><p style={{margin:"7px 0"}}>{x.solutionTitle}</p><small>{x.deliverable}</small></div>
      <div style={{display:"grid",gap:7,minWidth:145}}>
        <input type="number" min="0" defaultValue={x.price||0} aria-label="Fiyat" onBlur={e=>save(x,{price:Number(e.target.value),offerStatus:x.offerStatus||"draft"})}/>
        <select value={x.status} disabled={busy===x.id} onChange={e=>save(x,{status:e.target.value,price:x.price||0,offerStatus:x.offerStatus||"draft"})}><option value="open">Açık</option><option value="offered">Teklif</option><option value="approved">Onaylandı</option><option value="in-progress">Uygulanıyor</option><option value="resolved">Çözüldü</option><option value="dismissed">Kapatıldı</option></select>
      </div>
    </article>)}</div>}
  </section>;
}
