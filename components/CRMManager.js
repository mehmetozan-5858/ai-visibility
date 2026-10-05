"use client";
import {useEffect,useState} from "react";
const labels={new:"Yeni",contacted:"Temas edildi",meeting:"Görüşme",proposal:"Teklif",won:"Kazanıldı",lost:"Kaybedildi"};
export default function CRMManager(){
  const [rows,setRows]=useState([]),[busy,setBusy]=useState(""),[msg,setMsg]=useState("");
  async function load(){const r=await fetch("/api/sales-pipeline",{cache:"no-store"}),d=await r.json();if(r.ok)setRows(d.opportunities||[])}
  useEffect(()=>{load()},[]);
  async function update(row,patch){
    setBusy(row.id);setMsg("");
    try{
      const r=await fetch("/api/sales-pipeline",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id:row.id,...patch})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"Güncellenemedi.");await load();
    }catch(e){setMsg(e.message)}finally{setBusy("")}
  }
  return <section className="panel">
    <div className="section-title"><div><h2>Satış CRM</h2><small>Teklif hazırlanan müşterilerin takip hattı</small></div></div>
    {msg&&<p className="client-message">{msg}</p>}
    {!rows.length?<div className="empty">Henüz CRM fırsatı yok. Bir müşteride “Teklif hazırla” dediğinizde otomatik oluşur.</div>:
    <div className="client-list">{rows.map(x=><article className="client-row" key={x.id}>
      <div className="client-avatar">{x.stage==="won"?"✓":"◎"}</div>
      <div><b>{x.clientName}</b><small>{x.domain||""} · skor {x.score??"—"}/100 · {x.priority}</small></div>
      <span>{labels[x.stage]||x.stage}</span><textarea aria-label="CRM notu" placeholder="Görüşme / takip notu" defaultValue={x.notes||""} onBlur={e=>{if(e.target.value!==(x.notes||""))update(x,{stage:x.stage,nextFollowUp:x.nextFollowUp,notes:e.target.value})}} style={{minWidth:180,minHeight:58,background:"#071923",color:"#fff",border:"1px solid #24506a",borderRadius:9,padding:8}}/>
      <div style={{display:"grid",gap:6,minWidth:150}}>
        <select value={x.stage} disabled={busy===x.id} onChange={e=>update(x,{stage:e.target.value,nextFollowUp:x.nextFollowUp,notes:x.notes})} style={{background:"#071923",color:"#fff",border:"1px solid #24506a",borderRadius:9,padding:8}}>
          {Object.entries(labels).map(([v,l])=><option key={v} value={v}>{l}</option>)}
        </select>
        <input type="date" value={x.nextFollowUp?String(x.nextFollowUp).slice(0,10):""} onChange={e=>update(x,{stage:x.stage,nextFollowUp:e.target.value||null,notes:x.notes})} style={{background:"#071923",color:"#fff",border:"1px solid #24506a",borderRadius:9,padding:8}}/>
      </div>
    </article>)}</div>}
  </section>;
}
