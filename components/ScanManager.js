"use client";
import {useEffect,useRef,useState} from "react";

import {readScanWorkspace,provisionalScore,scanCompletionMessage} from "../lib/scan-workspace.js";

export default function ScanManager(){
  const [clients,setClients]=useState([]),[scans,setScans]=useState([]),[providers,setProviders]=useState([]),[clientId,setClientId]=useState(""),[query,setQuery]=useState(""),[busy,setBusy]=useState(false),[creating,setCreating]=useState(false),[quickName,setQuickName]=useState(""),[quickDomain,setQuickDomain]=useState(""),[msg,setMsg]=useState("");

  const [loading,setLoading]=useState(true),[loadError,setLoadError]=useState("");
  const version=useRef(0),controller=useRef(null);
  async function load(){
    const current=++version.current;controller.current?.abort();const c=new AbortController();controller.current=c;const timeout=setTimeout(()=>c.abort(),20000);setLoading(true);setLoadError("");
    try{const d=await readScanWorkspace(fetch,c.signal);if(current!==version.current)return;setClients(d.clients);setScans(d.scans);setProviders(d.providers);setClientId(id=>d.clients.some(x=>x.id===id)?id:d.clients[0]?.id||"")}
    catch(e){if(current===version.current){setClients([]);setScans([]);setProviders([]);setClientId("");setLoadError(e.message==="scan-session-required"?"Oturum doğrulanmadı. Yeniden giriş yapın.":e.message==="scan-database-required"?"Üretim veritabanı yapılandırması doğrulanmadı. Tarama verileri bilinmiyor.":"Tarama verileri alınamadı; müşteri, geçmiş ve sağlayıcı durumları bilinmiyor.")}}
    finally{clearTimeout(timeout);if(current===version.current)setLoading(false)}
  }
  useEffect(()=>{load();return()=>{version.current++;controller.current?.abort()}},[]);

  async function start(e){
    e.preventDefault(); setBusy(true); setMsg("");
    try{
      const queries=query.split("\n").map(x=>x.trim()).filter(Boolean);
      const r=await fetch("/api/scans",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({clientId,queries})});
      const d=await r.json();
      if(!r.ok)throw new Error([d.error,d.stage&&`Aşama: ${d.stage}`,d.detail].filter(Boolean).join(" · ")||"Tarama başlatılamadı.");
      if(d.live){
        setMsg(scanCompletionMessage(d));
      }else setMsg(d.note||"Tarama kuyruğa alındı.");
      await load();
    }catch(e){setMsg(e.message);await load()}finally{setBusy(false)}
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
      if(sd.live){
        setMsg(scanCompletionMessage(sd,"Hızlı test · "));
      }else setMsg(sd.note||"Test taraması kuyruğa alındı.");
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
    <div className="section-title"><div><h2>Tarama merkezi</h2><small>{loading?"Yükleniyor…":loadError?"Sağlayıcı durumu bilinmiyor":`${connected.length} sağlayıcı anahtarı yapılandırılmış`}</small></div></div>
    {loadError&&<p role="alert">{loadError} <button type="button" onClick={load} disabled={loading}>Yeniden dene</button>{loadError.includes("Oturum")&&<a href="/login">Giriş yap</a>}</p>}
    <p>Bu taramalar sağlayıcı ön değerlendirmesidir. Yapılandırılmış anahtar, başarılı API çağrısı kanıtı değildir. <a href={clientId?"/yanit-kanitlari?clientId="+encodeURIComponent(clientId):"/yanit-kanitlari"}>Gerçek AI yanıt kanıtlarını aç →</a></p>
    <div className="provider-grid">{["ChatGPT","Gemini","Perplexity"].map(name=>{const p=providers.find(x=>x.name===name);const ok=p?.status==="connected";return <div className={"provider "+(ok?"provider-on":"")} key={name}><b>{name}</b><span>{loading?"Yükleniyor…":!p?"○ Durum bilinmiyor":ok?"● Anahtar yapılandırılmış":"○ Anahtar gerekli"}</span></div>})}<div className="provider"><b>Google / Web</b><span>Web taraması sonraki aşama</span></div></div>

    {!loading&&!loadError&&clients.length===0&&<div className="scan-form">
      <h3>Hızlı test</h3>
      <p>Test kaydı oluşturup sağlayıcı ön değerlendirmesini başlatır. Test kaydı, ödeme yapan müşteri veya doğrulanmış görünürlük ölçümü sayılmaz.</p>
      <button type="button" onClick={quickTest} disabled={loading||!!loadError||creating||busy}>{creating||busy?"Test çalışıyor…":"⚡ Hızlı test müşterisi oluştur + tara"}</button>
    </div>}
    {!loading&&!loadError&&clients.length===0&&<form className="scan-form" onSubmit={createQuickClient}>
      <h3>İlk müşteriyi ekleyin</h3>
      <label>Marka / işletme adı<input value={quickName} onChange={e=>setQuickName(e.target.value)} placeholder="Örn. Acme" required/></label>
      <label>Web sitesi<input value={quickDomain} onChange={e=>setQuickDomain(e.target.value)} placeholder="ornek.com" required/></label>
      <button disabled={loading||!!loadError||creating}>{creating?"Ekleniyor…":"＋ Müşteri oluştur"}</button>
    </form>}
    <form className="scan-form" onSubmit={start}>
      <label>Müşteri<select value={clientId} onChange={e=>setClientId(e.target.value)} required><option value="">Müşteri seçin</option>{clients.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
      <label>Sorgular <small>(isteğe bağlı, her satıra bir sorgu)</small><textarea value={query} onChange={e=>setQuery(e.target.value)} placeholder="Bu işletme için içerik ve yapılandırılmış veri önerileri nelerdir?"/></label>
      <button disabled={loading||!!loadError||busy||!clientId} title={!clientId?"Önce müşteri seçin veya oluşturun":""}>{busy?"Taranıyor…":!clientId?"Önce müşteri seçin":"⌕ Tümünü Tara"}</button>
    </form>
    {msg&&<p className="client-message">{msg}</p>}

    <div className="scan-history"><h2>Son taramalar</h2>{loading?<p role="status">Tarama kayıtları yükleniyor…</p>:loadError?<p>Tarama geçmişi bilinmiyor.</p>:scans.length===0?<div className="empty">Henüz tarama yok.</div>:scans.map(s=><article className="scan-history-row" key={s.id}><div><b>{s.clientName||"Müşteri"}</b><small>{new Date(s.createdAt).toLocaleString("tr-TR",{timeZone:"Europe/Istanbul"})}</small></div><span>{s.status==="completed"?"Tamamlandı":s.status==="failed"?"Hata":s.status}</span><strong>Ön puan: {s.status==="completed"?provisionalScore(s.score):"—"}</strong>{s.status==="completed"&&Array.isArray(s.results)&&s.results.length>0&&<div style={{width:"100%",display:"flex",gap:8,flexWrap:"wrap",marginTop:7}}>{s.results.map((r,i)=><small key={i}>{r.provider}: ön puan {provisionalScore(r.score)}{r.visibility?.confidence!=null?` · sağlayıcı güven tahmini ${provisionalScore(r.visibility.confidence)}`:""}{r.visibility?.citationReadiness!=null?` · atıf hazırlığı tahmini ${provisionalScore(r.visibility.citationReadiness)}`:""}</small>)}</div>}</article>)}</div>
  </section>;
}
