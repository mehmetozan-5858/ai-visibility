"use client";
import {useEffect,useMemo,useState} from "react";

const statusLabel={new:"Yeni",contacted:"Temas",qualified:"Nitelikli",proposal:"Teklif",won:"Kazanıldı",lost:"Kaybedildi"};
const stages=["new","contacted","qualified","proposal","won"];

export default function SalesCommandCenter(){
  const [leads,setLeads]=useState([]),[candidates,setCandidates]=useState([]),[findings,setFindings]=useState([]),[busy,setBusy]=useState(""),[msg,setMsg]=useState("");
  async function load(){
    const [l,s,f]=await Promise.all([
      fetch("/api/leads",{cache:"no-store"}).then(r=>r.json()),
      fetch("/api/sales-agent",{cache:"no-store"}).then(r=>r.json()),
      fetch("/api/findings",{cache:"no-store"}).then(r=>r.json())
    ]);
    setLeads(l.leads||[]);setCandidates(s.candidates||[]);setFindings(f.findings||[]);
  }
  useEffect(()=>{load().catch(()=>setMsg("Sales Command Center verileri yüklenemedi."))},[]);

  async function moveLead(id,status){
    setBusy(id);setMsg("");
    try{
      const r=await fetch("/api/leads",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id,status})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"Lead güncellenemedi.");
      setMsg("Satış aşaması güncellendi.");await load();
    }catch(e){setMsg(e.message)}finally{setBusy("")}
  }

  const requested=findings.filter(x=>x.status==="requested"||x.offerStatus==="requested").length;
  const highOpp=candidates.filter(x=>Number(x.score)<=30).length;
  const activeLeads=leads.filter(x=>!["won","lost"].includes(x.status)).length;
  const won=leads.filter(x=>x.status==="won").length;
  const pipeline=useMemo(()=>stages.map(s=>({status:s,count:leads.filter(x=>x.status===s).length})),[leads]);
  const nextLeads=leads.filter(x=>!["won","lost"].includes(x.status)).slice(0,8);
  const topOpp=candidates.slice().sort((a,b)=>(Number(a.score)||100)-(Number(b.score)||100)).slice(0,6);

  return <section className="panel" style={{marginBottom:18}}>
    <div className="section-title"><div><h2>Sales Command Center</h2><small>Lead, fırsat, teklif ve çözüm taleplerini tek satış görünümünde toplar.</small></div></div>
    {msg&&<p className="client-message">{msg}</p>}
    <div className="report-kpis" style={{marginBottom:14}}>
      <div><span>Aktif lead</span><strong>{activeLeads}</strong></div>
      <div><span>Yüksek fırsat</span><strong>{highOpp}</strong></div>
      <div><span>Çözüm talebi</span><strong>{requested}</strong></div>
      <div><span>Kazanılan</span><strong>{won}</strong></div>
    </div>

    <div className="content-plan" style={{marginBottom:14}}>
      <b>Satış hunisi</b>
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(64px,1fr))",gap:8,marginTop:10,overflowX:"auto",paddingBottom:4}}>
        {pipeline.map(x=><div key={x.status} style={{padding:"10px 8px",border:"1px solid rgba(80,200,255,.25)",borderRadius:12,textAlign:"center",minWidth:64}}><small>{statusLabel[x.status]}</small><strong style={{display:"block",fontSize:22}}>{x.count}</strong></div>)}
      </div>
    </div>

    <div className="grid reports-grid" style={{gap:14}}>
      <article className="content-plan">
        <b>Takip bekleyen leadler</b>
        {!nextLeads.length?<div className="empty" style={{marginTop:10}}>Aktif lead yok.</div>:<div className="client-list" style={{marginTop:10}}>{nextLeads.map(x=><div className="client-row" key={x.id} style={{display:"grid",gridTemplateColumns:"minmax(0,1fr)",gap:8}}>
          <div style={{minWidth:0}}><b style={{overflowWrap:"anywhere"}}>{x.businessName}</b><small style={{overflowWrap:"anywhere"}}>{x.name} · {x.email}</small></div>
          <select value={x.status} disabled={busy===x.id} onChange={e=>moveLead(x.id,e.target.value)}>
            <option value="new">Yeni</option><option value="contacted">Temas edildi</option><option value="qualified">Nitelikli</option><option value="proposal">Teklif</option><option value="won">Kazanıldı</option><option value="lost">Kaybedildi</option>
          </select>
        </div>)}</div>}
      </article>

      <article className="content-plan">
        <b>Öncelikli satış fırsatları</b>
        {!topOpp.length?<div className="empty" style={{marginTop:10}}>Henüz tarama bazlı fırsat yok.</div>:<div className="client-list" style={{marginTop:10}}>{topOpp.map(x=>{
          const priority=Number(x.score)<=30?"Yüksek":Number(x.score)<=55?"Orta":"Takip";
          return <div className="client-row" key={x.id} style={{display:"block",padding:14}}>
            <b style={{display:"block",fontSize:17,lineHeight:1.25,overflowWrap:"break-word"}}>{x.name}</b>
            <small style={{display:"block",marginTop:6,lineHeight:1.35,overflowWrap:"anywhere"}}>{x.domain||"Web sitesi yok"} · skor {x.score}/100</small>
            <span style={{display:"inline-flex",width:"auto",marginTop:10,padding:"6px 10px",borderRadius:999}}>{priority}</span>
          </div>;
        })}</div>}
      </article>
    </div>
  </section>;
}
