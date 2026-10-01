"use client";
import {useEffect,useState} from "react";

export default function ScanManager(){
  const [clients,setClients]=useState([]),[scans,setScans]=useState([]),[providers,setProviders]=useState([]),[clientId,setClientId]=useState(""),[query,setQuery]=useState(""),[busy,setBusy]=useState(false),[creating,setCreating]=useState(false),[quickName,setQuickName]=useState(""),[quickDomain,setQuickDomain]=useState(""),[msg,setMsg]=useState("");

  async function load(){
    const [c,s,st]=await Promise.all([
      fetch("/api/clients",{cache:"no-store"}).then(r=>r.json()),
      fetch("/api/scans",{cache:"no-store"}).then(r=>r.json()),
      fetch("/api/status",{cache:"no-store"}).then(r=>r.json())
    ]);
    setClients(c.clients||[]); setScans(s.scans||[]); setProviders(st.providers||[]);
    if(!clientId && c.clients?.[0]?.id)setClientId(c.clients[0].id);
  }
  useEffect(()=>{load()},[]);

  async function start(e){
    e.preventDefault(); setBusy(true); setMsg("");
    try{
      const queries=query.split("\n").map(x=>x.trim()).filter(Boolean);
      const r=await fetch("/api/scans",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({clientId,queries})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||"Tarama başlatılamadı.");
      setMsg(d.live?`Tarama tamamlandı · ${d.provider} · skor ${d.scan.score}/100`:(d.note||"Tarama kuyruğa alındı."));
      await load();
    }catch(e){setMsg(e.message)}finally{setBusy(false)}
  }

  async function quickTest(){
    setCreating(true);setMsg("");
    try{
      let id=clients[0]?.id||"";
      if(!id){
        const cr=await fetch("/api/clients",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({
          name:"AI Visibility Test",
          domain:"ai-visibility-ai-visibility2.vercel.app",
          plan:"Starter",
          competitors:[]
        })});
        const cd=await cr.json();
        if(!cr.ok)throw new Error(cd.error||"Test müşterisi oluşturulamadı.");
        id=cd.client?.id||"";
        if(!id)throw new Error("Test müşterisi kimliği alınamadı.");
        setClientId(id);
        await load();
      }else{
        setClientId(id);
      }

      setBusy(true);
      const sr=await fetch("/api/scans",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({
        clientId:id,
        queries:["AI Visibility markası yapay zeka sonuçlarında nasıl görünür?","Bu marka için GEO/AEO iyileştirme önerileri nelerdir?"]
      })});
      const sd=await sr.json();
      if(!sr.ok)throw new Error(sd.error||"Test taraması başlatılamadı.");
      setMsg(sd.live
        ? `Hızlı test tamamlandı · ${sd.provider} · skor ${sd.scan?.score??"—"}/100`
        : (sd.note||"Test taraması kuyruğa alındı."));
      await load();
    }catch(e){setMsg(e.message)}
    finally{setBusy(false);setCreating(false)}
  }

  async function createQuickClient(e){
    e.preventDefault(); if(!quickName.trim()||!quickDomain.trim())return;
    setCreating(true);setMsg("");
    try{
      const r=await fetch("/api/clients",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name:quickName.trim(),domain:quickDomain.trim(),plan:"Starter",competitors:[]})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||"Müşteri oluşturulamadı.");
      setMsg("Müşteri oluşturuldu. Artık taramayı başlatabilirsiniz.");
      setQuickName("");setQuickDomain("");
      await load();
      if(d.client?.id)setClientId(d.client.id);
    }catch(e){setMsg(e.message)}finally{setCreating(false)}
  }

  const connected=providers.filter(x=>x.status==="connected");
  return <section className="panel">
    <div className="section-title"><div><h2>Tarama merkezi</h2><small>{connected.length} canlı sağlayıcı bağlı</small></div></div>
    <div className="provider-grid">{["ChatGPT","Gemini","Perplexity"].map(name=>{const p=providers.find(x=>x.name===name);const ok=p?.status==="connected";return <div className={"provider "+(ok?"provider-on":"")} key={name}><b>{name}</b><span>{ok?"● Bağlı":"○ Bağlantı gerekli"}</span></div>})}<div className="provider"><b>Google / Web</b><span>Web taraması sonraki aşama</span></div></div>

    {clients.length===0&&<div className="scan-form">
      <h3>Hızlı test</h3>
      <p>Elle müşteri girmeden test müşterisi oluşturup ChatGPT taramasını otomatik başlatır.</p>
      <button type="button" onClick={quickTest} disabled={creating||busy}>{creating||busy?"Test çalışıyor…":"⚡ Hızlı test müşterisi oluştur + tara"}</button>
    </div>}
    {clients.length===0&&<form className="scan-form" onSubmit={createQuickClient}>
      <h3>İlk müşteriyi ekleyin</h3>
      <label>Marka / işletme adı<input value={quickName} onChange={e=>setQuickName(e.target.value)} placeholder="Örn. Acme" required/></label>
      <label>Web sitesi<input value={quickDomain} onChange={e=>setQuickDomain(e.target.value)} placeholder="ornek.com" required/></label>
      <button disabled={creating}>{creating?"Ekleniyor…":"＋ Müşteri oluştur"}</button>
    </form>}
    <form className="scan-form" onSubmit={start}>
      <label>Müşteri<select value={clientId} onChange={e=>setClientId(e.target.value)} required><option value="">Müşteri seçin</option>{clients.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
      <label>Sorgular <small>(isteğe bağlı, her satıra bir sorgu)</small><textarea value={query} onChange={e=>setQuery(e.target.value)} placeholder="Bu marka ne kadar görünür?&#10;En iyi alternatifler hangileri?"/></label>
      <button disabled={busy||!clientId} title={!clientId?"Önce müşteri seçin veya oluşturun":""}>{busy?"Taranıyor…":!clientId?"Önce müşteri seçin":"⌕ Tarama Başlat"}</button>
    </form>
    {msg&&<p className="client-message">{msg}</p>}

    <div className="scan-history"><h2>Son taramalar</h2>{scans.length===0?<div className="empty">Henüz tarama yok.</div>:scans.map(s=><article className="scan-history-row" key={s.id}><div><b>{s.clientName||"Müşteri"}</b><small>{new Date(s.createdAt).toLocaleString("tr-TR")}</small></div><span>{s.status==="completed"?"Tamamlandı":s.status}</span><strong>{s.score==null?"—":s.score+"/100"}</strong></article>)}</div>
  </section>;
}
