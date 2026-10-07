"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {readDashboardSnapshot,measuredScans} from "../lib/dashboard-snapshot";
import BottomNavigation from "./BottomNavigation";
import LogoutButton from "./LogoutButton";

const agents=[["research","Araştırma Ajanı","Pazar, rakip ve lead araştırması"],["visibility","Görünürlük Ajanı","GEO / AEO tarama kuyruğu"],["content","İçerik Ajanı","İyileştirme taslakları"],["sales","Satış Ajanı","Dış iletişim insan onaylı"]];

export default function MobileDashboard(){
  const [summary,setSummary]=useState(null);
  const [loading,setLoading]=useState(true),[error,setError]=useState(""),[attempt,setAttempt]=useState(0);
  const [providers,setProviders]=useState([]);
  const [scans,setScans]=useState([]);
  const [authReady,setAuthReady]=useState(false);

  useEffect(()=>{
    const controller=new AbortController();let active=true;
    setLoading(true);setError("");setSummary(null);setProviders([]);setScans([]);setAuthReady(false);
    const timeout=setTimeout(()=>controller.abort(),20000);
    readDashboardSnapshot(fetch,controller.signal).then(d=>{
      if(!active)return;
      setSummary(d.summary);setProviders(d.providers);setScans(d.scans);setAuthReady(d.authReady);
    }).catch(e=>{
      if(active)setError(e.message==="dashboard-session-required"?"Oturumunuz sona ermiş olabilir. Yeniden giriş yapın.":"Panel verileri okunamadı. Bağlantınızı kontrol edip tekrar deneyin.");
    }).finally(()=>{clearTimeout(timeout);if(active)setLoading(false)});
    return ()=>{active=false;clearTimeout(timeout);controller.abort()};
  },[attempt]);

  const completed=useMemo(()=>measuredScans(scans),[scans]);
  const avgScore=completed.length?Math.round(completed.reduce((a,x)=>a+Number(x.score),0)/completed.length):null;
  const providerCounts=useMemo(()=>{
    const counts={};
    for(const s of completed){
      for(const r of Array.isArray(s.results)?s.results:[]){
        if(r?.provider)counts[r.provider]=(counts[r.provider]||0)+1;
      }
    }
    return counts;
  },[completed]);

  const stats=[
    ["user","Ödeme yapan aktif müşteri",summary?String(summary.activeClients):"—","Müşterileri gör","/musteriler"],
    ["cash","Aylık paket tutarı",(summary?.mrrByCurrency||[]).map(x=>new Intl.NumberFormat("tr-TR",{style:"currency",currency:x.currency}).format(x.amount)).join(" · ")||"—","Gelir raporu","/raporlar"],
    ["search","Bugünkü tarama",summary?String(summary.scansToday):"—","Raporları gör","/taramalar"],
    ["check","Onay bekleyen",summary?String(summary.approvals):"—","Onayları gör","/ajanlar"]
  ];

  const recentProviders=[
    ["G","Gemini",providerCounts.Gemini||0],
    ["◎","ChatGPT",providerCounts.ChatGPT||0],
    ["✦","Perplexity",providerCounts.Perplexity||0]
  ];

return <div className="mv">
<header className="mv-top"><div className="mv-menu">☰</div><Link href="/" className="mv-brand"><span>A</span><div><b>AI VISIBILITY</b><small>GEO / AEO ABONELİK YÖNETİM PANELİ</small></div></Link><div className="mv-safe">{authReady?"● CANLI / KORUMALI":"○ DURUM DOĞRULANMADI"}</div><div className="mv-avatar"><LogoutButton compact/></div></header>
<section className="mv-hero"><div className="mv-copy"><h1>Markanızı<br/>her yerde <em>görünür yapın</em></h1><p>Yapay zeka, arama motorları ve dijital platformlarda markanızın görünürlüğünü artırın.</p></div><div className="mv-globe"><div className="earth">AI</div><span className="g">G</span><span className="c">◎</span><span className="b">B</span><span className="p">✦</span></div></section>
{(loading||error)&&<section className="mv-card" aria-live="polite" aria-busy={loading}>{loading?<p>Panel verileri yükleniyor…</p>:error?<div role="alert"><p>{error}</p><button type="button" onClick={()=>setAttempt(x=>x+1)}>Tekrar dene</button>{error.includes("Oturum")&&<Link href="/login">Yeniden giriş yap</Link>}</div>:null}</section>}
<section className="mv-stats">{stats.map(([i,n,v,cta,h],k)=><a href={h} className={"mv-stat s"+k} key={n}><i>{i==="user"?"♟":i==="cash"?"▰":i==="search"?"⌕":"✓"}</i><span>{n}</span><strong>{v}</strong><small>{cta} →</small></a>)}</section>
<section className="mv-duo"><article className="mv-card mv-score"><h2>AI Görünürlük Skorunuz <small>ⓘ</small></h2><div className="mv-scorebody"><div className="mv-ring"><strong>{summary&&avgScore!==null?avgScore:"—"}</strong><span>/100</span></div><div className="mv-bench"><span>Canlı sağlayıcı</span><strong>{summary?providers.filter(x=>x.status==="connected").length:"—"}<small>/3</small></strong><div><i style={{width:(providers.filter(x=>x.status==="connected").length/3*100)+"%"}}/></div><b>{summary?completed.length:"—"} tamamlanan tarama</b><small>{!summary?"Veri bekleniyor":completed.length?"Tamamlanan taramalardan hesaplandı":"Henüz ölçüm yok"}</small></div></div><a href="/taramalar" className="mv-button">Detaylı analiz yap →</a></article>
<article className="mv-card mv-recent"><div className="mv-title"><h2>Son Taramalar</h2><a href="/taramalar">→</a></div>{recentProviders.map(x=><div className="mv-scan" key={x[1]}><i>{x[0]}</i><span><b>{x[1]}</b><small>{summary?x[2]:"—"} sonuç</small></span><em>{x[2]?"●":"—"}</em><strong>⌁</strong></div>)}</article></section>
<section className="mv-card mv-agents"><div className="mv-title"><h2>Ajan Merkezi</h2><a href="/ajanlar">Tüm ajanları gör →</a></div><div className="mv-agentgrid">{agents.map(([i,n,d])=><a href="/ajanlar" className="mv-agent" key={n}><div className={"mv-agentpic "+i}/><b>{n}</b><p>{d}</p><small>● Aktif <em>→</em></small></a>)}</div></section>
<section className="mv-card mv-actions"><div className="mv-title"><h2>Hızlı İşlemler</h2><span>Tüm işlemler →</span></div><div className="mv-actiongrid"><a href="/musteriler"><b>♟＋</b><span>Yeni Müşteri</span></a><a href="/taramalar"><b>⌕</b><span>Tarama Başlat</span></a><a href="/raporlar"><b>▤</b><span>Rapor Oluştur</span></a><a href="/ayarlar"><b>⚙</b><span>Ayarlar</span></a></div></section>
<BottomNavigation/></div>}
