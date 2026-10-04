"use client";
import {useEffect,useMemo,useState} from "react";

function clamp(n){return Math.max(0,Math.min(100,Math.round(Number(n)||0)))}
function level(score){if(score>=75)return "Güçlü";if(score>=50)return "Geliştirilmeli";return "Kritik"}
function impactLabel(score,high){if(score>=65||high>=3)return "Yüksek";if(score>=35||high>=1)return "Orta";return "Düşük"}

export default function CommerceImpactManager(){
  const [clients,setClients]=useState([]),[scans,setScans]=useState([]),[findings,setFindings]=useState([]),[clientId,setClientId]=useState(""),[msg,setMsg]=useState(""),[busy,setBusy]=useState("");

  async function load(){
    const [c,s,f]=await Promise.all([
      fetch("/api/clients",{cache:"no-store"}).then(r=>r.json()),
      fetch("/api/scans",{cache:"no-store"}).then(r=>r.json()),
      fetch("/api/findings",{cache:"no-store"}).then(r=>r.json())
    ]);
    const list=c.clients||[];setClients(list);setScans(s.scans||[]);setFindings(f.findings||[]);setClientId(prev=>prev||(list[0]?.id||""));
  }

  useEffect(()=>{load().catch(()=>setMsg("Commerce Ready verileri yüklenemedi."))},[]);

  async function setPriority(x,priority){
    setBusy(x.id);setMsg("");
    try{
      const r=await fetch("/api/findings",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({findingId:x.id,offerId:x.offerId,priority})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"Öncelik güncellenemedi.");
      setMsg(priority?"Aksiyon önceliklendirildi.":"Aksiyon öncelikten çıkarıldı.");await load();
    }catch(e){setMsg(e.message)}finally{setBusy("")}
  }

  const client=useMemo(()=>clients.find(x=>x.id===clientId)||null,[clients,clientId]);
  const latest=useMemo(()=>scans.filter(x=>x.clientId===clientId&&x.status==="completed"&&Number.isFinite(Number(x.score))).sort((a,b)=>new Date(b.completedAt||b.createdAt)-new Date(a.completedAt||a.createdAt))[0]||null,[scans,clientId]);
  const clientFindings=useMemo(()=>findings.filter(x=>x.clientId===clientId),[findings,clientId]);
  const unresolved=clientFindings.filter(x=>!["resolved","dismissed"].includes(x.status));
  const critical=unresolved.filter(x=>x.severity==="critical").length;
  const high=unresolved.filter(x=>x.severity==="high").length;
  const requested=clientFindings.filter(x=>x.status==="requested"||x.offerStatus==="requested").length;
  const prioritized=unresolved.filter(x=>x.priority).length;
  const aiScore=clamp(latest?.score||0);
  const p=client?.profile||{};
  const profileFields=[p.country,p.city,p.sector,p.phone,p.contactEmail];
  const profileScore=clamp((profileFields.filter(Boolean).length/profileFields.length)*100);
  const resolutionScore=clamp(100-critical*25-high*12-unresolved.filter(x=>x.severity==="medium").length*6-unresolved.filter(x=>x.severity==="low").length*3);
  const readiness=latest?clamp((aiScore+profileScore+resolutionScore)/3):clamp((profileScore+resolutionScore)/2);
  const impactRisk=clamp((100-aiScore)*.65+critical*15+high*8);
  const weights={critical:4,high:3,medium:2,low:1};
  const topActions=unresolved.slice().sort((a,b)=>Number(b.priority)-Number(a.priority)||(weights[b.severity]||0)-(weights[a.severity]||0)).slice(0,5);

  if(!clients.length&&!msg)return <section className="panel"><p>Commerce Ready verileri yükleniyor…</p></section>;
  return <section className="grid reports-grid">
    <article className="panel" style={{gridColumn:"1/-1"}}>
      <div className="section-title"><div><h2>Commerce Ready + Business Impact</h2><small>İşletmenin AI destekli keşif ve ticari dönüşüm hazırlığını ölçer; görünürlük açıklarını iş etkisine bağlar.</small></div></div>
      <label className="report-select">Müşteri<select value={clientId} onChange={e=>{setClientId(e.target.value);setMsg("")}}>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      {msg&&<p className="client-message">{msg}</p>}
    </article>

    <article className="panel">
      <div className="report-heading"><h2>Commerce Ready</h2><small>V1 doğrulanabilir sinyaller</small></div>
      <div className="report-kpis"><div><span>Hazırlık skoru</span><strong>{readiness}/100</strong></div><div><span>Durum</span><strong>{level(readiness)}</strong></div><div><span>Açık bulgu</span><strong>{unresolved.length}</strong></div></div>
      <div className="content-ideas" style={{marginTop:14}}>
        <div><strong>AI bulunabilirliği</strong><small>{latest?aiScore+"/100":"Tamamlanmış tarama yok"}</small></div>
        <div><strong>İşletme veri bütünlüğü</strong><small>{profileScore}/100 · ülke, şehir, sektör, telefon, e-posta</small></div>
        <div><strong>Çözüm hazırlığı</strong><small>{resolutionScore}/100 · açık bulgulara göre</small></div>
      </div>
      <div className="content-plan" style={{marginTop:14}}>
        <b>Henüz doğrulanmayan ticari sinyaller</b>
        <ul><li>Ürün / hizmet kataloğu</li><li>Fiyat ve teklif netliği</li><li>Stok / uygunluk sinyali</li><li>Satın alma / rezervasyon yolu</li></ul>
        <small>Bu alanlar veri kaynağı bağlanmadan skora dahil edilmez; sistem tahmin üretmez.</small>
      </div>
    </article>

    <article className="panel">
      <div className="report-heading"><h2>Business Impact</h2><small>Gelir uydurmadan operasyonel etki</small></div>
      <div className="report-kpis"><div><span>Etki riski</span><strong>{impactRisk}/100</strong></div><div><span>Seviye</span><strong>{impactLabel(impactRisk,high)}</strong></div><div><span>Öncelikli aksiyon</span><strong>{prioritized}</strong></div></div>
      <div className="content-ideas" style={{marginTop:14}}>
        <div><strong>Talep edilen çözüm</strong><small>{requested} kayıt</small></div>
        <div><strong>Kritik açık</strong><small>{critical} kayıt</small></div>
        <div><strong>Yüksek öncelik</strong><small>{high} kayıt</small></div>
        <div><strong>Görünürlük açığı</strong><small>{latest?100-aiScore:"—"} puan</small></div>
      </div>
      <div className="content-plan" style={{marginTop:14}}><b>Not</b><p style={{marginBottom:0}}>Parasal gelir etkisi göstermek için gerçek trafik, dönüşüm, sepet/rezervasyon değeri veya satış verisi gerekir. Bu V1 ekranı yalnız doğrulanmış sistem verilerinden risk ve öncelik üretir.</p></div>
    </article>

    <article className="panel" style={{gridColumn:"1/-1"}}>
      <div className="section-title"><div><h2>Öncelikli ticari aksiyonlar</h2><small>Öncelik verilen kayıtlar üstte tutulur; seçim veritabanına kaydedilir.</small></div></div>
      {!topActions.length?<div className="empty">Bu müşteri için açık aksiyon bulunmuyor.</div>:<div className="client-list">{topActions.map(x=><div className="client-row" key={x.id} style={{alignItems:"center",gap:12}}><div style={{minWidth:0,flex:1}}><b>{x.title}</b><small>{x.severity==="critical"?"Kritik":x.severity==="high"?"Yüksek":x.severity==="medium"?"Orta":"Düşük"} · {x.status==="requested"?"Talep edildi":x.status}{x.priority?" · Öncelikli":""}</small>{x.solutionTitle&&<small>{x.solutionTitle}</small>}</div><div style={{display:"flex",alignItems:"center",gap:8,flex:"0 0 auto",flexWrap:"wrap",justifyContent:"flex-end"}}>{x.price>0&&<span>{Number(x.price).toLocaleString("tr-TR")} {x.currency||"TL"}</span>}<button type="button" disabled={busy===x.id} onClick={()=>setPriority(x,!x.priority)} style={{width:"auto",minWidth:118,padding:"10px 14px",minHeight:42,alignSelf:"center"}}>{busy===x.id?"Kaydediliyor…":x.priority?"Öncelikten çıkar":"Önceliklendir"}</button></div></div>)}</div>}
    </article>
  </section>;
}
