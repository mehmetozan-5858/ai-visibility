"use client";
import {useEffect,useMemo,useState} from "react";

export default function ReportsManager(){
  const [scans,setScans]=useState([]),[clients,setClients]=useState([]),[filter,setFilter]=useState("all"),[contentPlan,setContentPlan]=useState(null),[contentBusy,setContentBusy]=useState(false),[contentMsg,setContentMsg]=useState("");
  useEffect(()=>{Promise.all([fetch("/api/scans",{cache:"no-store"}).then(r=>r.json()),fetch("/api/clients",{cache:"no-store"}).then(r=>r.json())]).then(([s,c])=>{setScans(s.scans||[]);setClients(c.clients||[])})},[]);
  const rows=useMemo(()=>filter==="all"?scans:scans.filter(x=>x.clientId===filter),[scans,filter]);
  const completed=rows.filter(x=>x.status==="completed"&&Number.isFinite(Number(x.score)));
  const avg=completed.length?Math.round(completed.reduce((a,x)=>a+Number(x.score),0)/completed.length):null;
  async function generateContentPlan(){
    setContentMsg("");setContentPlan(null);
    if(filter==="all"){setContentMsg("İçerik planı için bir müşteri seçin.");return}
    setContentBusy(true);
    try{
      const r=await fetch("/api/content-agent",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({clientId:filter})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||"İçerik planı üretilemedi.");
      setContentPlan(d.plan||null);
    }catch(e){setContentMsg(e.message)}
    finally{setContentBusy(false)}
  }

  function esc(v=""){return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
  function download(){
    const selectedName=filter==="all"?"Tüm müşteriler":clients.find(c=>c.id===filter)?.name||"Müşteri";
    const cards=completed.map(x=>{
      const result=Array.isArray(x.results)?x.results[0]||{}:{};
      const findings=Array.isArray(result.findings)?result.findings:[];
      const recommendations=Array.isArray(result.recommendations)?result.recommendations:[];
      return `<section class="scan"><h2>${esc(x.clientName||selectedName)} — ${esc(x.score)}/100</h2><p><b>Durum:</b> Tamamlandı</p><p><b>Sağlayıcı:</b> ${esc(result.provider||"Gemini")}</p><p><b>Tarih:</b> ${esc(new Date(x.completedAt||x.createdAt).toLocaleString("tr-TR"))}</p>${result.summary?`<h3>Özet</h3><p>${esc(result.summary)}</p>`:""}${findings.length?`<h3>Bulgular</h3><ul>${findings.map(v=>`<li>${esc(v)}</li>`).join("")}</ul>`:""}${recommendations.length?`<h3>Öneriler</h3><ul>${recommendations.map(v=>`<li>${esc(v)}</li>`).join("")}</ul>`:""}</section>`;
    }).join("");
    const html=`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AI Visibility Raporu</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;background:#f5f7fb;color:#17202a;margin:0;padding:24px;line-height:1.55}.wrap{max-width:820px;margin:auto}.hero,.scan{background:white;border:1px solid #dce5ec;border-radius:18px;padding:22px;margin-bottom:16px}.hero h1{margin:0 0 10px}.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:18px}.kpis div{background:#eef5fa;border-radius:12px;padding:14px}.kpis span{display:block;color:#657786;font-size:13px}.kpis strong{font-size:24px}.scan h2{margin-top:0}.scan h3{margin-bottom:6px}ul{padding-left:20px}@media(max-width:600px){body{padding:12px}.kpis{grid-template-columns:1fr}}</style></head><body><div class="wrap"><section class="hero"><h1>AI Visibility Raporu</h1><p><b>Müşteri:</b> ${esc(selectedName)}</p><p><b>Oluşturulma:</b> ${esc(new Date().toLocaleString("tr-TR"))}</p><div class="kpis"><div><span>Tarama</span><strong>${rows.length}</strong></div><div><span>Tamamlanan</span><strong>${completed.length}</strong></div><div><span>Ortalama skor</span><strong>${avg==null?"—":avg+"/100"}</strong></div></div></section>${cards||"<section class='scan'><p>Tamamlanmış tarama bulunamadı.</p></section>"}</div></body></html>`;
    const blob=new Blob([html],{type:"text/html;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download="ai-visibility-rapor.html";a.click();URL.revokeObjectURL(url);
  }
  return <section className="grid reports-grid">
    <article className="panel"><h2>Görünürlük özeti</h2><div className="report-kpis"><div><span>Tarama</span><strong>{rows.length}</strong></div><div><span>Tamamlanan</span><strong>{completed.length}</strong></div><div><span>Ortalama skor</span><strong>{avg==null?"—":avg+"/100"}</strong></div></div><div className="chart-placeholder">{completed.length?"Son tamamlanan taramalar rapora dahil edildi.":"Rapor oluşturmak için en az bir tamamlanmış tarama gerekiyor."}</div></article>
    <article className="panel"><h2>Rapor oluştur</h2><p>Müşteri seçerek sonucu okunabilir rapor halinde görüntüleyin ve indirin.</p><label className="report-select">Müşteri<select value={filter} onChange={e=>{setFilter(e.target.value);setContentPlan(null);setContentMsg("")}}><option value="all">Tüm müşteriler</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><button onClick={download} disabled={!rows.length}>▤ Okunabilir raporu indir</button>{completed.slice(0,3).map(x=>{const result=Array.isArray(x.results)?x.results[0]||{}:{};return <div className="report-preview" key={x.id}><strong>{x.clientName}</strong><span>{x.score}/100</span>{result.summary&&<p>{result.summary}</p>}{Array.isArray(result.recommendations)&&result.recommendations.length>0&&<><b>Öneriler</b><ul>{result.recommendations.slice(0,3).map((v,i)=><li key={i}>{v}</li>)}</ul></>}</div>})}</article>
    <article className="panel"><h2>İçerik Ajanı</h2><p>Son tamamlanan taramadan GEO/AEO içerik planı üretir.</p><button onClick={generateContentPlan} disabled={contentBusy||filter==="all"}>{contentBusy?"Üretiliyor…":"✦ İçerik planı üret"}</button>{contentMsg&&<p className="client-message">{contentMsg}</p>}{contentPlan&&<div className="content-plan"><h3>{contentPlan.headline}</h3><b>Öncelikler</b><ul>{(contentPlan.priorities||[]).map((x,i)=><li key={i}>{x}</li>)}</ul><b>İçerik fikirleri</b><div className="content-ideas">{(contentPlan.contentIdeas||[]).map((x,i)=><div key={i}><strong>{x.title}</strong><small>{x.format} · {x.goal}</small></div>)}</div><b>Hızlı kazanımlar</b><ul>{(contentPlan.quickWins||[]).map((x,i)=><li key={i}>{x}</li>)}</ul></div>}</article>
  </section>;
}
