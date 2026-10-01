"use client";
import {useEffect,useMemo,useState} from "react";

export default function ReportsManager(){
  const [scans,setScans]=useState([]),[clients,setClients]=useState([]),[filter,setFilter]=useState("all");
  useEffect(()=>{Promise.all([fetch("/api/scans",{cache:"no-store"}).then(r=>r.json()),fetch("/api/clients",{cache:"no-store"}).then(r=>r.json())]).then(([s,c])=>{setScans(s.scans||[]);setClients(c.clients||[])})},[]);
  const rows=useMemo(()=>filter==="all"?scans:scans.filter(x=>x.clientId===filter),[scans,filter]);
  const completed=rows.filter(x=>x.status==="completed"&&Number.isFinite(Number(x.score)));
  const avg=completed.length?Math.round(completed.reduce((a,x)=>a+Number(x.score),0)/completed.length):null;
  function download(){
    const data=JSON.stringify({generatedAt:new Date().toISOString(),client:filter,averageScore:avg,scans:rows},null,2);
    const blob=new Blob([data],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download="ai-visibility-rapor.json";a.click();URL.revokeObjectURL(url);
  }
  return <section className="grid reports-grid">
    <article className="panel"><h2>Görünürlük özeti</h2><div className="report-kpis"><div><span>Tarama</span><strong>{rows.length}</strong></div><div><span>Tamamlanan</span><strong>{completed.length}</strong></div><div><span>Ortalama skor</span><strong>{avg==null?"—":avg+"/100"}</strong></div></div><div className="chart-placeholder">{completed.length?"Son tamamlanan taramalar rapora dahil edildi.":"Rapor oluşturmak için en az bir tamamlanmış tarama gerekiyor."}</div></article>
    <article className="panel"><h2>Rapor oluştur</h2><p>Müşteri seçerek mevcut tarama sonuçlarını dışa aktarın.</p><label className="report-select">Müşteri<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Tüm müşteriler</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><button onClick={download} disabled={!rows.length}>▤ Raporu indir</button></article>
  </section>;
}
