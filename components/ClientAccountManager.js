"use client";
import {useEffect,useMemo,useRef,useState} from "react";

import Link from "next/link";
import {accountScanEstimates,readClientAccount,recordedEstimateDelta} from "../lib/client-account-view";
import {provisionalScore} from "../lib/scan-workspace";

const typeLabels={
  contact:"Temas",
  report:"Rapor teslimi",
  recommendation:"Öneri / eksik",
  "customer-action":"Müşteri uygulaması",
  approval:"Onay",
  scan:"Tarama",
  payment:"Ödeme",
  complaint:"Şikayet",
  refund:"İade",
  note:"Not"
};

export default function ClientAccountManager(){
  const [clients,setClients]=useState([]),[clientId,setClientId]=useState(""),[account,setAccount]=useState(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[msg,setMsg]=useState(""),[revision,setRevision]=useState(0),[clientsReady,setClientsReady]=useState(false);
  const selected=useRef(clientId),generation=useRef(0);
  selected.current=clientId;
  useEffect(()=>{
    const controller=new AbortController();let active=true;
    const timer=setTimeout(()=>controller.abort(),20000);
    setClientsReady(false);setLoading(true);setMsg("");
    fetch("/api/clients",{cache:"no-store",signal:controller.signal}).then(async r=>{
      if(!r.ok)throw Error("Müşteriler okunamadı. Oturumunuzu ve bağlantınızı kontrol edin.");
      const d=await r.json();
      if(!Array.isArray(d.clients)||!d.clients.every(x=>x?.id&&typeof x.name==="string"))throw Error("Müşteri listesi doğrulanamadı.");
      if(!active)return;
      setClients(d.clients);setClientsReady(true);
      setClientId(current=>d.clients.some(x=>x.id===current)?current:d.clients[0]?.id||"");
      setLoading(false);
    }).catch(e=>{if(active){setClients([]);setAccount(null);setMsg(e.name==="AbortError"?"Müşteri listesi zamanında alınamadı.":e.message);setLoading(false)}});
    return ()=>{active=false;clearTimeout(timer);controller.abort()};
  },[revision]);

  useEffect(()=>{
    const version=++generation.current,controller=new AbortController();
    setAccount(null);
    if(!clientId||!clientsReady)return;
    setLoading(true);setMsg("");
    const timer=setTimeout(()=>controller.abort(),20000);
    readClientAccount(fetch,clientId,controller.signal).then(d=>{
      if(version===generation.current&&!controller.signal.aborted)setAccount(d);
    }).catch(e=>{if(version===generation.current)setMsg(e.name==="AbortError"?"İşletme hesabı zamanında alınamadı.":e.message)}).finally(()=>{
      clearTimeout(timer);if(version===generation.current)setLoading(false);
    });
    return ()=>{++generation.current;clearTimeout(timer);controller.abort()};
  },[clientId,clientsReady,revision]);

  async function addEvent(e){
    e.preventDefault();if(busy)return;
    const form=e.currentTarget,id=clientId,fd=new FormData(form);
    setBusy(true);setMsg("");
    try{
      const r=await fetch("/api/client-activity",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({
        clientId:id,eventType:fd.get("eventType"),title:fd.get("title"),detail:fd.get("detail")
      })});
      const d=await r.json();if(!r.ok||!d.activity?.id)throw Error("Kayıt eklenemedi. Yeniden denemeden önce geçmişi kontrol edin.");
      if(selected.current!==id)return;
      form.reset();setRevision(v=>v+1);
    }catch(e2){if(selected.current===id)setMsg(e2.message)}finally{setBusy(false)}
  }

  const visibleAccount=account?.client?.id===clientId?account:null;
  const {first,latest,count}=useMemo(()=>accountScanEstimates(visibleAccount?.scans),[visibleAccount]);

  return <section className="panel">
    <div className="section-title"><div><h2>İşletme içi hesap</h2><small>Temas, teslim ve uygulama kayıtları; ayrı ölçüm kanıtları</small></div></div>
    <label className="report-select">İşletme<select value={clientId} disabled={busy||!clientsReady} onChange={e=>{selected.current=e.target.value;setAccount(null);setLoading(Boolean(e.target.value));setClientId(e.target.value)}}>
      <option value="">İşletme seçin</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
    </select></label>

    {msg&&<p className="client-message" role="status">{msg} <button type="button" disabled={busy||loading} onClick={()=>setRevision(v=>v+1)}>Yeniden yükle</button></p>}
    {clientsReady&&!loading&&!clients.length&&<div className="empty">Henüz işletme kaydı yok.</div>}
    {loading?<div className="empty">İşletme hesabı yükleniyor…</div>:visibleAccount&&<>
      <div className="report-kpis" style={{marginTop:14}}>
        <div><span>Yüklenen en eski ön puan</span><strong>{provisionalScore(first?.score)}</strong></div>
        <div><span>Yüklenen en yeni ön puan</span><strong>{provisionalScore(latest?.score)}</strong></div>
        <div><span>Geçerli ön değerlendirme kaydı</span><strong>{count}</strong></div>
      </div>
      <div className="content-plan" style={{marginTop:12}}>
        <b>Gerçek başlangıç ve takip ölçümleri</b>
        <p>Bu ön puanlar yüklenen son 30 tarama içinden gösterilir. Farklı sorgu, sağlayıcı veya model sonuçları iyileşme kanıtı olarak karşılaştırılmaz. Faaliyet kaydı da uygulamanın etkisini tek başına doğrulamaz.</p>
        <Link href={"/yanit-kanitlari?clientId="+encodeURIComponent(clientId)}>İşletmenin yanıt kanıtlarını aç →</Link>
      </div>

      <form className="scan-form" onSubmit={addEvent} style={{marginTop:16}}>
        <h3>Yeni faaliyet kaydı</h3>
        <p>Elle eklenen kayıt yönetici beyanıdır; bağımsız uygulama veya sonuç doğrulaması değildir.</p>
        <label>Kayıt türü<select name="eventType" defaultValue="contact">
          <option value="contact">Temas / görüşme</option>
          <option value="report">Rapor teslim edildi</option>
          <option value="recommendation">Eksik / öneri bildirildi</option>
          <option value="customer-action">Müşteri öneriyi uyguladı</option>
          <option value="approval">Müşteri onayı</option>
          <option value="complaint">Şikayet / memnuniyetsizlik</option>
          <option value="refund">İade talebi / sonucu</option>
          <option value="note">Diğer not</option>
        </select></label>
        <label>Başlık<input name="title" required placeholder="Örn. FAQ ve schema önerileri müşteriye iletildi"/></label>
        <label>Detay<textarea name="detail" placeholder="Tarih, görüşme özeti, müşterinin cevabı, uyguladığı değişiklikler, teslim edilen dosya vb."/></label>
        <button disabled={busy}>{busy?"Kaydediliyor…":"＋ İşletme geçmişine ekle"}</button>
      </form>

      <div className="scan-history" style={{marginTop:18}}>
        <h2>Faaliyet zaman çizelgesi</h2>
        {(visibleAccount.activity||[]).length===0?<div className="empty">Henüz faaliyet kaydı yok.</div>:(visibleAccount.activity||[]).map(x=>
          <article className="scan-history-row" key={x.id}>
            <div><b>{x.title}</b><small>{typeLabels[x.eventType]||x.eventType} · {new Date(x.createdAt).toLocaleString("tr-TR",{timeZone:"Europe/Istanbul"})}</small>{x.detail&&<small style={{marginTop:4}}>{x.detail}</small>}</div>
            <span>{recordedEstimateDelta(x.metadata?.delta)|| (x.metadata?.manual?"Yönetici beyanı":"Kaydedildi")}</span>
          </article>
        )}
      </div>

      <details className="report-preview compact" style={{marginTop:16}}>
        <summary><span><strong>Sözleşme ve ödeme kanıtları</strong><small>Onay zamanları ve ödeme durumu</small></span><b>›</b></summary>
        <div className="report-detail">
          {(visibleAccount.payments||[]).length===0?<p>Ödeme kaydı yok.</p>:(visibleAccount.payments||[]).map(p=><div key={p.id} style={{marginBottom:12}}>
            <b>{p.plan} · {p.status}</b>
            <p>Hizmet başlangıcı onayı: {p.serviceStartConsentAt?new Date(p.serviceStartConsentAt).toLocaleString("tr-TR",{timeZone:"Europe/Istanbul"}):"Henüz yok"}</p>
            {p.termsVersion&&<small>Sözleşme sürümü: {p.termsVersion}</small>}
          </div>)}
        </div>
      </details>
    </>}
  </section>;
}
