"use client";
import {useEffect,useMemo,useState} from "react";

export default function CustomerPortal(){
  const [account,setAccount]=useState(null),[msg,setMsg]=useState("");
  useEffect(()=>{
    fetch("/api/client-portal",{cache:"no-store"}).then(async r=>{
      const d=await r.json();if(!r.ok)throw new Error(d.error||"Panel yüklenemedi.");return d;
    }).then(d=>setAccount(d.account)).catch(e=>setMsg(e.message));
  },[]);
  const completed=useMemo(()=>account?.scans?.filter(x=>x.status==="completed"&&Number.isFinite(Number(x.score)))||[],[account]);
  const latest=completed[0]||null;
  if(msg)return <section className="panel"><p className="client-message">{msg}</p></section>;
  if(!account)return <section className="panel"><p>Müşteri paneli yükleniyor…</p></section>;
  return <section className="grid reports-grid">
    <article className="panel">
      <h2>{account.client.name}</h2>
      <p>{account.client.domain}</p>
      <div className="report-kpis">
        <div><span>AI görünürlük</span><strong>{latest?.score==null?"—":latest.score+"/100"}</strong></div>
        <div><span>Paket</span><strong>{account.client.plan||"—"}</strong></div>
        <div><span>Tamamlanan tarama</span><strong>{completed.length}</strong></div>
      </div>
    </article>
    <article className="panel">
      <h2>Çalışmalar</h2>
      {(account.workItems||[]).length===0?<div className="empty">Henüz çalışma kaydı yok.</div>:
      <div className="client-list">{account.workItems.slice(0,20).map(x=><div className="client-row" key={x.id}><div><b>{x.title}</b><small>{x.category} · {x.status}</small>{x.detail&&<small>{x.detail}</small>}</div></div>)}</div>}
    </article>
    <article className="panel">
      <h2>Son taramalar</h2>
      {completed.length===0?<div className="empty">Henüz tamamlanmış tarama yok.</div>:
      <div className="client-list">{completed.slice(0,10).map(x=><div className="client-row" key={x.id}><div><b>{x.score}/100</b><small>{new Date(x.completedAt||x.createdAt).toLocaleString("tr-TR")}</small></div></div>)}</div>}
    </article>
    <article className="panel">
      <h2>Ödemeler</h2>
      {(account.payments||[]).length===0?<div className="empty">Ödeme kaydı yok.</div>:
      <div className="client-list">{account.payments.slice(0,10).map(x=><div className="client-row" key={x.id}><div><b>{x.plan}</b><small>{x.status} · {(Number(x.setupAmount||0)+Number(x.monthlyAmount||0)).toLocaleString("tr-TR")} TL</small></div></div>)}</div>}
    </article>
  </section>;
}
