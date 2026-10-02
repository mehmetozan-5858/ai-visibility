"use client";
import {useEffect,useMemo,useState} from "react";

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
  const [clients,setClients]=useState([]),[clientId,setClientId]=useState(""),[account,setAccount]=useState(null),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[msg,setMsg]=useState("");

  useEffect(()=>{
    fetch("/api/clients",{cache:"no-store"}).then(r=>r.json()).then(d=>{
      const rows=d.clients||[];setClients(rows);
      if(rows[0]?.id)setClientId(rows[0].id);
    }).catch(()=>setMsg("Müşteriler okunamadı."));
  },[]);

  async function load(id=clientId){
    if(!id)return;setLoading(true);setMsg("");
    try{
      const r=await fetch("/api/client-activity?clientId="+encodeURIComponent(id),{cache:"no-store"});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"İşletme hesabı okunamadı.");
      setAccount(d.account||null);
    }catch(e){setMsg(e.message)}finally{setLoading(false)}
  }
  useEffect(()=>{if(clientId)load(clientId)},[clientId]);

  async function addEvent(e){
    e.preventDefault();setBusy(true);setMsg("");
    const fd=new FormData(e.currentTarget);
    try{
      const r=await fetch("/api/client-activity",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({
        clientId,eventType:fd.get("eventType"),title:fd.get("title"),detail:fd.get("detail")
      })});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"Kayıt eklenemedi.");
      e.currentTarget.reset();setMsg("İşletme geçmişine kayıt eklendi.");await load();
    }catch(e2){setMsg(e2.message)}finally{setBusy(false)}
  }

  const completed=useMemo(()=>account?.scans?.filter(x=>x.status==="completed"&&Number.isFinite(Number(x.score)))||[],[account]);
  const latest=completed[0]||null, first=completed.length?completed[completed.length-1]:null;
  const totalChange=latest&&first?Number(latest.score)-Number(first.score):null;

  return <section className="panel">
    <div className="section-title"><div><h2>İşletme içi hesap</h2><small>Temas, teslim, uygulama ve önce/sonra kanıt geçmişi</small></div></div>
    <label className="report-select">İşletme<select value={clientId} onChange={e=>setClientId(e.target.value)}>
      <option value="">İşletme seçin</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
    </select></label>

    {msg&&<p className="client-message">{msg}</p>}
    {loading?<div className="empty">İşletme hesabı yükleniyor…</div>:account&&<>
      <div className="report-kpis" style={{marginTop:14}}>
        <div><span>İlk skor</span><strong>{first?.score==null?"—":first.score+"/100"}</strong></div>
        <div><span>Son skor</span><strong>{latest?.score==null?"—":latest.score+"/100"}</strong></div>
        <div><span>Toplam değişim</span><strong>{totalChange==null?"—":(totalChange>0?"+":"")+totalChange}</strong></div>
      </div>

      {latest&&first&&latest.id!==first.id&&<div className="content-plan" style={{marginTop:12}}>
        <b>Önce / sonra özeti</b>
        <p>{totalChange>0
          ? `Görünürlük skoru ${first.score}/100 seviyesinden ${latest.score}/100 seviyesine yükseldi. Bu otomatik bir iyileşme sinyalidir; hangi önerinin uygulandığı aşağıdaki faaliyet kayıtlarıyla doğrulanır.`
          : totalChange<0
          ? `Görünürlük skoru ${first.score}/100 seviyesinden ${latest.score}/100 seviyesine geriledi. Neden ayrıca incelenmelidir.`
          : `İlk ve son görünürlük skoru ${latest.score}/100. Uygulanan işlemlerin sağlayıcı bazındaki etkisi ayrıca incelenmelidir.`}</p>
      </div>}

      <form className="scan-form" onSubmit={addEvent} style={{marginTop:16}}>
        <h3>Yeni faaliyet / kanıt kaydı</h3>
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
        <h2>Kanıt ve faaliyet zaman çizelgesi</h2>
        {(account.activity||[]).length===0?<div className="empty">Henüz faaliyet kaydı yok.</div>:(account.activity||[]).map(x=>
          <article className="scan-history-row" key={x.id}>
            <div><b>{x.title}</b><small>{typeLabels[x.eventType]||x.eventType} · {new Date(x.createdAt).toLocaleString("tr-TR")}</small>{x.detail&&<small style={{marginTop:4}}>{x.detail}</small>}</div>
            {x.metadata?.delta!=null?<strong>{x.metadata.delta>0?"+":""}{x.metadata.delta}</strong>:<span>Kaydedildi</span>}
          </article>
        )}
      </div>

      <details className="report-preview compact" style={{marginTop:16}}>
        <summary><span><strong>Sözleşme ve ödeme kanıtları</strong><small>Onay zamanları ve ödeme durumu</small></span><b>›</b></summary>
        <div className="report-detail">
          {(account.payments||[]).length===0?<p>Ödeme kaydı yok.</p>:(account.payments||[]).map(p=><div key={p.id} style={{marginBottom:12}}>
            <b>{p.plan} · {p.status}</b>
            <p>Hizmet başlangıcı onayı: {p.serviceStartConsentAt?new Date(p.serviceStartConsentAt).toLocaleString("tr-TR"):"Henüz yok"}</p>
            {p.termsVersion&&<small>Sözleşme sürümü: {p.termsVersion}</small>}
          </div>)}
        </div>
      </details>
    </>}
  </section>;
}
