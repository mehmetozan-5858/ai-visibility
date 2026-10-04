"use client";
import {useEffect,useMemo,useState} from "react";
import FindingsManager from "./FindingsManager";

const tabs=[["findings","Bulgular"],["content","İçerik Ajanı"],["implementation","Uygulama Ajanı"],["history","Tarama Geçmişi"]];

export default function ReportsManager(){
  const [tab,setTab]=useState("findings");
  const [scans,setScans]=useState([]),[clients,setClients]=useState([]),[filter,setFilter]=useState("all"),[contentPlan,setContentPlan]=useState(null),[contentBusy,setContentBusy]=useState(false),[contentMsg,setContentMsg]=useState(""),[implementation,setImplementation]=useState(null),[implementationBusy,setImplementationBusy]=useState(false),[implementationMsg,setImplementationMsg]=useState("");
  useEffect(()=>{Promise.all([fetch("/api/scans",{cache:"no-store"}).then(r=>r.json()),fetch("/api/clients",{cache:"no-store"}).then(r=>r.json())]).then(([s,c])=>{setScans(s.scans||[]);setClients(c.clients||[])})},[]);
  const rows=useMemo(()=>filter==="all"?scans:scans.filter(x=>x.clientId===filter),[scans,filter]);
  const completedAll=rows.filter(x=>x.status==="completed"&&Number.isFinite(Number(x.score)));
  const completed=filter==="all"?Array.from(new Map(completedAll.map(x=>[x.clientId,x])).values()):completedAll.slice(0,1);
  const avg=completed.length?Math.round(completed.reduce((a,x)=>a+Number(x.score),0)/completed.length):null;
  const targetId=filter==="all"?(completed[0]?.clientId||""):filter;
  const selectedName=clients.find(c=>c.id===filter)?.name||(filter==="all"?"Tüm müşteriler":"Müşteri");

  function resetAgentState(next){
    setFilter(next);setContentPlan(null);setContentMsg("");setImplementation(null);setImplementationMsg("");
  }
  async function generateContentPlan(){
    setContentMsg("");setContentPlan(null);
    if(!targetId){setContentMsg("İçerik planı için tamamlanmış bir tarama gerekiyor.");return}
    const targetName=clients.find(c=>c.id===targetId)?.name||completed[0]?.clientName||"Müşteri";
    setContentBusy(true);
    try{const r=await fetch("/api/content-agent",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({clientId:targetId})});const d=await r.json();if(!r.ok)throw new Error(d.error||"İçerik planı üretilemedi.");setContentPlan(d.plan||null);setContentMsg(targetName+" için içerik planı hazırlandı.")}catch(e){setContentMsg(e.message)}finally{setContentBusy(false)}
  }
  async function generateImplementation(){
    setImplementationMsg("");setImplementation(null);
    if(!targetId){setImplementationMsg("Eksikleri uygulamak için tamamlanmış bir tarama gerekiyor.");return}
    const targetName=clients.find(c=>c.id===targetId)?.name||completed[0]?.clientName||"Müşteri";
    setImplementationBusy(true);
    try{const r=await fetch("/api/implementation-agent",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({clientId:targetId})});const d=await r.json();if(!r.ok)throw new Error([d.error,d.detail].filter(Boolean).join(" · ")||"Uygulama paketi hazırlanamadı.");setImplementation(d.plan||null);setImplementationMsg(targetName+" için uygulama paketi hazırlandı.")}catch(e){setImplementationMsg(e.message)}finally{setImplementationBusy(false)}
  }
  function download(){const qs=filter==="all"?"":("?clientId="+encodeURIComponent(filter));window.location.href="/api/reports/pdf"+qs}

  return <section>
    <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8,paddingBottom:5,marginBottom:14}}>
      {tabs.map(([id,label])=><button key={id} type="button" onClick={()=>setTab(id)} aria-pressed={tab===id} style={{width:"100%",minWidth:0,whiteSpace:"normal",textAlign:"center",opacity:tab===id?1:.62,boxShadow:tab===id?"0 0 0 2px #4aa7ff55":"none"}}>{label}</button>)}
    </div>

    {tab==="findings"&&<FindingsManager/>}

    {tab==="content"&&<article className="panel">
      <div className="section-title"><div><h2>İçerik Ajanı</h2><small>GEO/AEO içerik planını seçilen müşterinin son tamamlanan taramasından üretir.</small></div></div>
      <label className="report-select">Müşteri<select value={filter} onChange={e=>resetAgentState(e.target.value)}><option value="all">Otomatik: en güncel müşteri</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <button onClick={generateContentPlan} disabled={contentBusy||completed.length===0}>{contentBusy?"Üretiliyor…":"✦ İçerik planı üret"}</button>
      {contentMsg&&<p className="client-message">{contentMsg}</p>}
      {contentPlan&&<div className="content-plan"><h3>{contentPlan.headline}</h3><b>Öncelikler</b><ul>{(contentPlan.priorities||[]).map((x,i)=><li key={i}>{x}</li>)}</ul><b>İçerik fikirleri</b><div className="content-ideas">{(contentPlan.contentIdeas||[]).map((x,i)=><div key={i}><strong>{x.title}</strong><small>{x.format} · {x.goal}</small></div>)}</div><b>Hızlı kazanımlar</b><ul>{(contentPlan.quickWins||[]).map((x,i)=><li key={i}>{x}</li>)}</ul></div>}
    </article>}

    {tab==="implementation"&&<article className="panel">
      <div className="section-title"><div><h2>Uygulama Ajanı</h2><small>Tarama eksiklerini uygulanabilir teslimlere dönüştürür; dış sistem değişikliklerinden önce erişim ve müşteri onayı ister.</small></div></div>
      <label className="report-select">Müşteri<select value={filter} onChange={e=>resetAgentState(e.target.value)}><option value="all">Otomatik: en güncel müşteri</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <button onClick={generateImplementation} disabled={implementationBusy||completed.length===0}>{implementationBusy?"Hazırlanıyor…":"⚙ Eksikleri uygula"}</button>
      {implementationMsg&&<p className="client-message">{implementationMsg}</p>}
      {implementation&&<div className="content-plan"><h3>{implementation.headline||"Uygulama paketi"}</h3><b>Hemen hazırlananlar</b><div className="content-ideas">{(implementation.readyNow||[]).map((x,i)=><div key={i}><strong>{x.title}</strong><small>{x.type}</small><p>{x.deliverable}</p></div>)}</div><b>Hazır SSS</b><ul>{(implementation.faq||[]).map((x,i)=><li key={i}><strong>{x.q}</strong><br/>{x.a}</li>)}</ul><b>Meta başlık</b><p>{implementation.meta?.title}</p><b>Meta açıklama</b><p>{implementation.meta?.description}</p><b>Müşteriden gerekli bilgiler</b><div className="content-ideas">{(implementation.approvalRequired||[]).map((x,i)=><div key={i}><strong>{x.field}</strong><small>{x.reason}</small></div>)}</div><details className="report-preview compact" style={{marginTop:12}}><summary><span><strong>Teknik detayları göster</strong><small>Schema.org / JSON-LD kodu</small></span><b>›</b></summary><div className="report-detail"><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",fontSize:11,padding:10,border:"1px solid #173c50",borderRadius:10}}>{JSON.stringify(implementation.schema?.jsonLd||{},null,2)}</pre></div></details><b>Lokasyon sayfası</b><p>{implementation.locationPage?.title}</p><ul>{(implementation.locationPage?.outline||[]).map((x,i)=><li key={i}>{x}</li>)}</ul><b>Erişim gereken işler</b><ul>{(implementation.accessRequired||[]).map((x,i)=><li key={i}>{x.system}: {x.action}</li>)}</ul><b>Sonraki adımlar</b><ul>{(implementation.nextSteps||[]).map((x,i)=><li key={i}>{x}</li>)}</ul></div>}
    </article>}

    {tab==="history"&&<section className="grid reports-grid">
      <article className="panel report-summary"><div className="report-heading"><h2>Tarama geçmişi</h2><small>{selectedName}</small></div><div className="report-kpis"><div><span>Tarama</span><strong>{rows.length}</strong></div><div><span>Tamamlanan</span><strong>{completedAll.length}</strong></div><div><span>Ort. skor</span><strong>{avg==null?"—":avg+"/100"}</strong></div></div></article>
      <article className="panel"><label className="report-select">Müşteri<select value={filter} onChange={e=>resetAgentState(e.target.value)}><option value="all">Tüm müşteriler</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><button onClick={download} disabled={!rows.length}>▤ PDF raporu indir</button><div className="report-compact-list">{completedAll.slice(0,20).map(x=>{const results=Array.isArray(x.results)?x.results:[];return <details className="report-preview compact" key={x.id}><summary><span><strong>{x.clientName}</strong><small>{new Date(x.completedAt||x.createdAt).toLocaleString("tr-TR")}</small></span><b>{x.score}/100</b></summary><div className="report-detail"><div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>{results.map((r,i)=><span key={i} style={{padding:"6px 9px",border:"1px solid #28516a",borderRadius:10}}>{r.provider||"AI"} · {r.score??"—"}/100</span>)}</div>{results.map((r,i)=><div key={i} style={{marginBottom:14}}><b>{r.provider||"AI"}</b>{r.summary&&<p>{r.summary}</p>}{Array.isArray(r.recommendations)&&r.recommendations.length>0&&<ul>{r.recommendations.slice(0,2).map((v,j)=><li key={j}>{v}</li>)}</ul>}</div>)}</div></details>})}</div></article>
    </section>}
  </section>;
}
