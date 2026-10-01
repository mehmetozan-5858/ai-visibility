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
  async function download(){
    const chosenClient=filter==="all"?null:clients.find(c=>c.id===filter);
    const completedRows=rows.filter(x=>x.status==="completed");
    const pdfMakeModule=await import("pdfmake/build/pdfmake");
    const fontsModule=await import("pdfmake/build/vfs_fonts");
    const pdfMake=pdfMakeModule.default||pdfMakeModule;
    const vfsSource=fontsModule.default||fontsModule;
    if(vfsSource?.pdfMake?.vfs) pdfMake.vfs=vfsSource.pdfMake.vfs;
    else if(vfsSource?.vfs) pdfMake.vfs=vfsSource.vfs;

    const sections=[];
    for(const scan of completedRows){
      const result=Array.isArray(scan.results)?(scan.results[0]||{}):{};
      sections.push(
        {text:scan.clientName||"Müşteri",style:"scanTitle",margin:[0,14,0,4]},
        {text:`Tarih: ${new Date(scan.completedAt||scan.createdAt).toLocaleString("tr-TR")}  |  Skor: ${scan.score??"—"}/100`,style:"meta"},
        result.summary?{text:result.summary,margin:[0,6,0,6]}:null,
        Array.isArray(result.findings)&&result.findings.length?{text:"Bulgular",style:"subhead"}:null,
        Array.isArray(result.findings)&&result.findings.length?{ul:result.findings,margin:[0,0,0,6]}:null,
        Array.isArray(result.recommendations)&&result.recommendations.length?{text:"Öneriler",style:"subhead"}:null,
        Array.isArray(result.recommendations)&&result.recommendations.length?{ul:result.recommendations,margin:[0,0,0,8]}:null
      );
    }

    const doc={
      pageSize:"A4",
      pageMargins:[40,46,40,46],
      info:{title:"AI Visibility Raporu",author:"AI Visibility"},
      content:[
        {text:"AI VISIBILITY",style:"brand"},
        {text:"Görünürlük Raporu",style:"title"},
        {text:chosenClient?chosenClient.name:"Tüm Müşteriler",style:"client"},
        {columns:[
          {width:"*",stack:[{text:"Toplam tarama",style:"label"},{text:String(rows.length),style:"kpi"}]},
          {width:"*",stack:[{text:"Tamamlanan",style:"label"},{text:String(completedRows.length),style:"kpi"}]},
          {width:"*",stack:[{text:"Ortalama skor",style:"label"},{text:avg==null?"—":avg+"/100",style:"kpi"}]}
        ],columnGap:12,margin:[0,18,0,18]},
        {text:"Tamamlanan taramalar",style:"section"},
        ...sections.filter(Boolean),
        {text:"Bu rapor AI Visibility sistemi tarafından oluşturulmuştur.",style:"footer",margin:[0,24,0,0]}
      ],
      styles:{
        brand:{fontSize:10,bold:true,color:"#1889d7",characterSpacing:1.5},
        title:{fontSize:24,bold:true,margin:[0,6,0,4]},
        client:{fontSize:14,color:"#4b6270"},
        label:{fontSize:9,color:"#718896"},
        kpi:{fontSize:20,bold:true,margin:[0,3,0,0]},
        section:{fontSize:15,bold:true,margin:[0,8,0,8]},
        scanTitle:{fontSize:13,bold:true},
        subhead:{fontSize:10,bold:true,margin:[0,4,0,3]},
        meta:{fontSize:9,color:"#718896"},
        footer:{fontSize:8,color:"#8da2af",italics:true}
      },
      defaultStyle:{fontSize:10,lineHeight:1.25}
    };

    const safe=(chosenClient?.name||"tum-musteriler").toLocaleLowerCase("tr-TR").replace(/[^a-z0-9ığüşöç]+/gi,"-");
    pdfMake.createPdf(doc).download(`ai-visibility-${safe}.pdf`);
  }
  return <section className="grid reports-grid">
    <article className="panel"><h2>Görünürlük özeti</h2><div className="report-kpis"><div><span>Tarama</span><strong>{rows.length}</strong></div><div><span>Tamamlanan</span><strong>{completed.length}</strong></div><div><span>Ortalama skor</span><strong>{avg==null?"—":avg+"/100"}</strong></div></div><div className="chart-placeholder">{completed.length?"Son tamamlanan taramalar rapora dahil edildi.":"Rapor oluşturmak için en az bir tamamlanmış tarama gerekiyor."}</div></article>
    <article className="panel"><h2>Rapor oluştur</h2><p>Müşteri seçerek sonucu okunabilir rapor halinde görüntüleyin ve indirin.</p><label className="report-select">Müşteri<select value={filter} onChange={e=>{setFilter(e.target.value);setContentPlan(null);setContentMsg("")}}><option value="all">Tüm müşteriler</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><button onClick={download} disabled={!rows.length}>▤ Okunabilir raporu indir</button>{completed.slice(0,3).map(x=>{const result=Array.isArray(x.results)?x.results[0]||{}:{};return <div className="report-preview" key={x.id}><strong>{x.clientName}</strong><span>{x.score}/100</span>{result.summary&&<p>{result.summary}</p>}{Array.isArray(result.recommendations)&&result.recommendations.length>0&&<><b>Öneriler</b><ul>{result.recommendations.slice(0,3).map((v,i)=><li key={i}>{v}</li>)}</ul></>}</div>})}</article>
    <article className="panel"><h2>İçerik Ajanı</h2><p>Son tamamlanan taramadan GEO/AEO içerik planı üretir.</p><button onClick={generateContentPlan} disabled={contentBusy||filter==="all"}>{contentBusy?"Üretiliyor…":"✦ İçerik planı üret"}</button>{contentMsg&&<p className="client-message">{contentMsg}</p>}{contentPlan&&<div className="content-plan"><h3>{contentPlan.headline}</h3><b>Öncelikler</b><ul>{(contentPlan.priorities||[]).map((x,i)=><li key={i}>{x}</li>)}</ul><b>İçerik fikirleri</b><div className="content-ideas">{(contentPlan.contentIdeas||[]).map((x,i)=><div key={i}><strong>{x.title}</strong><small>{x.format} · {x.goal}</small></div>)}</div><b>Hızlı kazanımlar</b><ul>{(contentPlan.quickWins||[]).map((x,i)=><li key={i}>{x}</li>)}</ul></div>}</article>
  </section>;
}
