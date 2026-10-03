"use client";
import {useEffect,useMemo,useState} from "react";

const severityLabel={critical:"Kritik",high:"Yüksek",medium:"Orta",low:"Düşük"};
const statusLabel={open:"Açık",requested:"Talep edildi",offered:"Teklif hazır",approved:"Onaylandı","in-progress":"Uygulanıyor",resolved:"Çözüldü",draft:"Hazırlanıyor",accepted:"Kabul edildi",paid:"Ödendi",completed:"Tamamlandı"};

export default function CustomerPortal(){
  const [account,setAccount]=useState(null),[findings,setFindings]=useState([]),[msg,setMsg]=useState(""),[busy,setBusy]=useState("");
  async function load(){
    try{
      const [a,f]=await Promise.all([
        fetch("/api/client-portal",{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||"Panel yüklenemedi.");return d}),
        fetch("/api/client-portal/solutions",{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||"Çözümler yüklenemedi.");return d})
      ]);
      setAccount(a.account);setFindings(f.findings||[]);
    }catch(e){setMsg(e.message)}
  }
  useEffect(()=>{load()},[]);
  const completed=useMemo(()=>account?.scans?.filter(x=>x.status==="completed"&&Number.isFinite(Number(x.score)))||[],[account]);
  const latest=completed[0]||null;
  async function requestSolution(id){
    setBusy(id);setMsg("");
    try{
      const r=await fetch("/api/client-portal/solutions",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({findingId:id})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"Talep gönderilemedi.");
      setMsg(d.message||"Çözüm talebiniz alındı.");await load();
    }catch(e){setMsg(e.message)}finally{setBusy("")}
  }
  if(msg&&!account)return <section className="panel"><p className="client-message">{msg}</p></section>;
  if(!account)return <section className="panel"><p>Müşteri paneli yükleniyor…</p></section>;
  return <section className="grid reports-grid">
    {msg&&<article className="panel"><p className="client-message">{msg}</p></article>}
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
      <h2>Bulgu ve çözümler</h2>
      <p>Taramanızda bulunan sorunları ve hazırlanabilecek çözümleri burada görebilirsiniz.</p>
      {!findings.length?<div className="empty">Henüz müşteri paneline aktarılmış bulgu yok.</div>:
      <div className="client-list">{findings.slice(0,30).map(x=><article className="client-row" key={x.id}>
        <div><b>{x.title}</b><small>{severityLabel[x.severity]||x.severity} · {x.provider||"AI"}</small><small>{x.solutionTitle||"AI görünürlük iyileştirmesi"}</small>{x.deliverable&&<small>{x.deliverable}</small>}</div>
        <span>{x.price>0?Number(x.price).toLocaleString("tr-TR")+" "+x.currency:(statusLabel[x.offerStatus]||"Fiyat hazırlanıyor")}</span>
        {x.status==="requested"||x.offerStatus==="requested"?<em>Talep edildi</em>:x.status==="resolved"?<em>Çözüldü</em>:<button disabled={busy===x.id} onClick={()=>requestSolution(x.id)}>{busy===x.id?"Gönderiliyor…":"Çözümü istiyorum"}</button>}
      </article>)}</div>}
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
