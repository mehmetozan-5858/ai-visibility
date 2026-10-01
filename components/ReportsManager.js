"use client";
import {useEffect,useMemo,useState} from "react";

export default function ReportsManager(){
  const [scans,setScans]=useState([]),[clients,setClients]=useState([]),[filter,setFilter]=useState("all"),[contentPlan,setContentPlan]=useState(null),[contentBusy,setContentBusy]=useState(false),[contentMsg,setContentMsg]=useState("");
  useEffect(()=>{Promise.all([fetch("/api/scans",{cache:"no-store"}).then(r=>r.json()),fetch("/api/clients",{cache:"no-store"}).then(r=>r.json())]).then(([s,c])=>{setScans(s.scans||[]);setClients(c.clients||[])})},[]);
  const rows=useMemo(()=>filter==="all"?scans:scans.filter(x=>x.clientId===filter),[scans,filter]);
  const completedAll=rows.filter(x=>x.status==="completed"&&Number.isFinite(Number(x.score)));
  const completed=filter==="all"
    ? Array.from(new Map(completedAll.map(x=>[x.clientId,x])).values())
    : completedAll.slice(0,1);
  const avg=completed.length?Math.round(completed.reduce((a,x)=>a+Number(x.score),0)/completed.length):null;
  async function generateContentPlan(){
    setContentMsg("");setContentPlan(null);
    const targetId=filter==="all"
      ? (completed[0]?.clientId||"")
      : filter;
    if(!targetId){setContentMsg("İçerik planı için tamamlanmış bir tarama gerekiyor.");return}
    const targetName=clients.find(c=>c.id===targetId)?.name||completed[0]?.clientName||"Müşteri";
    setContentBusy(true);
    try{
      const r=await fetch("/api/content-agent",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({clientId:targetId})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||"İçerik planı üretilemedi.");
      setContentPlan(d.plan||null);
      setContentMsg(targetName+" için içerik planı hazırlandı.");
    }catch(e){setContentMsg(e.message)}
    finally{setContentBusy(false)}
  }

  function esc(v=""){return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
  function download(){
    const qs=filter==="all"?"":("?clientId="+encodeURIComponent(filter));
    window.location.href="/api/reports/pdf"+qs;
  }
  return <section className="grid reports-grid">
    <article className="panel report-summary"><div className="report-heading"><h2>Görünürlük özeti</h2><small>{completed.length?"Son tamamlanan taramalar":"Henüz tamamlanan tarama yok"}</small></div><div className="report-kpis"><div><span>Tarama</span><strong>{rows.length}</strong></div><div><span>Tamamlanan</span><strong>{completed.length}</strong></div><div><span>Ort. skor</span><strong>{avg==null?"—":avg+"/100"}</strong></div></div></article>
    <article className="panel"><h2>Rapor oluştur</h2><p>Tek müşteri seçerseniz son taramanın detaylı müşteri raporu; “Tüm müşteriler” seçiliyse kısa portföy özeti oluşturulur.</p><label className="report-select">Müşteri<select value={filter} onChange={e=>{setFilter(e.target.value);setContentPlan(null);setContentMsg("")}}><option value="all">Tüm müşteriler</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><button onClick={download} disabled={!rows.length}>▤ PDF raporu indir</button><div className="report-compact-list">{completed.slice(0,8).map(x=>{const results=Array.isArray(x.results)?x.results:[];return <details className="report-preview compact" key={x.id}><summary><span><strong>{x.clientName}</strong><small>{new Date(x.completedAt||x.createdAt).toLocaleString("tr-TR")}</small></span><b>{x.score}/100</b></summary><div className="report-detail"><div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>{results.map((r,i)=><span key={i} style={{padding:"6px 9px",border:"1px solid #28516a",borderRadius:10}}>{r.provider||"AI"} · {r.score??"—"}/100</span>)}</div>{results.map((r,i)=><div key={i} style={{marginBottom:14}}><b>{r.provider||"AI"}</b>{r.summary&&<p>{r.summary}</p>}{Array.isArray(r.recommendations)&&r.recommendations.length>0&&<ul>{r.recommendations.slice(0,2).map((v,j)=><li key={j}>{v}</li>)}</ul>}</div>)}</div></details>})}</div></article>
    <article className="panel"><h2>İçerik Ajanı</h2><p>Son tamamlanan taramadan GEO/AEO içerik planı üretir.</p><button onClick={generateContentPlan} disabled={contentBusy||completed.length===0}>{contentBusy?"Üretiliyor…":"✦ İçerik planı üret"}</button>{contentMsg&&<p className="client-message">{contentMsg}</p>}{contentPlan&&<div className="content-plan"><h3>{contentPlan.headline}</h3><b>Öncelikler</b><ul>{(contentPlan.priorities||[]).map((x,i)=><li key={i}>{x}</li>)}</ul><b>İçerik fikirleri</b><div className="content-ideas">{(contentPlan.contentIdeas||[]).map((x,i)=><div key={i}><strong>{x.title}</strong><small>{x.format} · {x.goal}</small></div>)}</div><b>Hızlı kazanımlar</b><ul>{(contentPlan.quickWins||[]).map((x,i)=><li key={i}>{x}</li>)}</ul></div>}</article>
  </section>;
}
