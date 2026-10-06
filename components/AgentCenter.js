"use client";
import {useEffect,useMemo,useState} from "react";
import SystemHealthMap from "./SystemHealthMap";

function fmt(v){if(!v)return "-";try{return new Date(v).toLocaleString("tr-TR")}catch{return String(v)}}
function marketText(m){
 if(Array.isArray(m?.markets))return m.markets.map(x=>[x?.city,x?.country].filter(Boolean).join(", ")).filter(Boolean).join(" · ")||"-";
 return [m?.city,m?.country].filter(Boolean).join(", ")||"-";
}
function markets(m){return Array.isArray(m?.markets)?m.markets:[]}

export default function AgentCenter(){
  const [data,setData]=useState(null),[error,setError]=useState("");
  const [businessRecent,setBusinessRecent]=useState([]),[creatorRecent,setCreatorRecent]=useState([]),[selected,setSelected]=useState(null);
  const load=()=>fetch("/api/agent-center",{cache:"no-store"}).then(async r=>{if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||"Yüklenemedi");return r.json()}).then(setData).catch(e=>setError(e.message));
  useEffect(()=>{load();Promise.all([fetch("/api/prospects",{cache:"no-store"}).then(r=>r.json()),fetch("/api/creator-hunt-leads",{cache:"no-store"}).then(r=>r.json())]).then(([b,c])=>{setBusinessRecent((b.prospects||[]).slice(0,8));setCreatorRecent((c.leads||[]).slice(0,8))}).catch(()=>{})},[]);
  const latest=data?.latest;
  const lastAt=latest?.finishedAt?new Date(latest.finishedAt).getTime():0;
  const ageMinutes=lastAt?Math.max(0,Math.floor((Date.now()-lastAt)/60000)):null;
  const health=useMemo(()=>!latest?"🟡 BEKLENİYOR":latest.errorCount>0?"🔴 HATA":ageMinutes!==null&&ageMinutes<=90?"🟢 ONLINE":"🟡 GECİKMİŞ",[latest,ageMinutes]);
  const nextAt=lastAt?new Date(lastAt+60*60*1000):null;
  const world=data?.worldNetwork;
  const parallel=markets(latest?.market);
  const successRate=latest?.scanned?Math.round((Number(latest.completed||0)/Number(latest.scanned))*100):0;
  return <div>
    <section className="panel" style={{marginBottom:18}}>
      <h2 style={{marginTop:0}}>Son Bulunanlar</h2>
      <p style={{opacity:.72}}>Ultra Mega Makine'nin en son bulduğu işletme ve creator adayları.</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:12}}>
        <div><h3>İşletme / Business</h3>{businessRecent.length?businessRecent.map(x=><button key={x.id} onClick={()=>setSelected({type:"business",...x})} className="panel" style={{padding:10,marginBottom:8,width:"100%",textAlign:"left",cursor:"pointer"}}><b>{x.name}</b><small style={{display:"block",opacity:.7}}>{[x.city,x.country,x.sector].filter(Boolean).join(" · ")}</small><small style={{display:"block",opacity:.7}}>{x.qualificationLevel==="hot"?"🔥 HOT · ":""}Durum: {x.scanStatus||x.status||"yeni"} · Ticari skor: {x.qualificationScore??x.score??0}</small></button>):<small>Henüz kayıt yok.</small>}</div>
        <div><h3>Sosyal Medya / Creator</h3>{creatorRecent.length?creatorRecent.map(x=><button key={x.id} onClick={()=>setSelected({type:"creator",...x})} className="panel" style={{padding:10,marginBottom:8,width:"100%",textAlign:"left",cursor:"pointer"}}><b>{x.displayName||x.handle}</b><small style={{display:"block",opacity:.7}}>{[x.platform,x.country,x.niche].filter(Boolean).join(" · ")}</small><small style={{display:"block",opacity:.7}}>{((Number(x.opportunityScore)||0)*.5+(Number(x.monetizationScore)||0)*.2+(Number(x.brandReadinessScore)||0)*.2+(["founder-executive","expert-personal-brand","established","niche-authority","educator","local-influencer"].includes(String(x.creatorTier||"").toLowerCase())?10:0)+(x.publicContact?5:0))>=65?"🔥 HOT · ":""}Fırsat: {x.opportunityScore??0} · Ticari: {x.monetizationScore??0} · Marka: {x.brandReadinessScore??0}</small></button>):<small>Henüz kayıt yok.</small>}</div>
      </div>
      {selected?<div className="panel" style={{marginTop:14,padding:14}}><div style={{display:"flex",justifyContent:"space-between",gap:10}}><h3 style={{margin:0}}>Aday Detayı</h3><button onClick={()=>setSelected(null)}>Kapat</button></div><div style={{fontWeight:800,fontSize:18,marginTop:10}}>{selected.type==="business"?selected.name:(selected.displayName||selected.handle)}</div><p style={{marginBottom:6}}>{selected.type==="business"?[selected.city,selected.country,selected.sector].filter(Boolean).join(" · "):[selected.platform,selected.country,selected.niche].filter(Boolean).join(" · ")}</p><small style={{display:"block",opacity:.75}}>Neden seçildi: {selected.qualificationReason||selected.reason||selected.outreachReason||selected.evidence?.reason||(selected.type==="creator"?[selected.creatorTier&&`Profil: ${selected.creatorTier}`,Number(selected.monetizationScore)>0&&`Ticari potansiyel: ${selected.monetizationScore}`,Number(selected.brandReadinessScore)>0&&`Marka hazırlığı: ${selected.brandReadinessScore}`,selected.publicContact&&"Kamusal ticari iletişim mevcut"].filter(Boolean).join(" · "):"")||"Yeni av adayı; derin analiz/kanıt aşaması bekleniyor."}</small><small style={{display:"block",opacity:.75,marginTop:5}}>Skor: {selected.type==="business"?(selected.qualificationScore??selected.score??"Henüz yok"):(selected.opportunityScore??0)}</small><small style={{display:"block",opacity:.75,marginTop:5}}>Sıradaki işlem: {selected.nextBestAction||selected.scanStatus||(selected.type==="business"?"Derin analiz / yeterlilik kontrolü":"Creator fırsat analizi")}</small></div>:null}
    </section>
    <section className="panel" style={{marginBottom:18}}>
      <h2 style={{marginTop:0}}>Son İşlem / Sonuç</h2>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:12}}>
        <div className="panel" style={{padding:12}}><b>Business Motoru</b><div style={{marginTop:6}}>Son av: {fmt(latest?.finishedAt)}</div><small style={{display:"block",opacity:.7}}>Bulunan {latest?.discovered??0} · Yeni {latest?.newProspects??0} · Analiz {latest?.completed??0} · Hata {latest?.errorCount??0}</small></div>
        <div className="panel" style={{padding:12}}><b>Creator Motoru</b><div style={{marginTop:6}}>Son kayıt: {fmt(creatorRecent[0]?.createdAt)}</div><small style={{display:"block",opacity:.7}}>Gösterilen son aday {creatorRecent.length} · En yüksek fırsat skoru {creatorRecent.length?Math.max(...creatorRecent.map(x=>Number(x.opportunityScore)||0)):0}</small></div>
      </div>
    </section>
    
    <section className="panel" style={{marginBottom:18}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start",flexWrap:"wrap"}}>
        <div><h2 style={{marginTop:0}}>Global Av Canlı Durum</h2><p style={{marginBottom:0,opacity:.72}}>Ajanların gerçek çalışma durumunu tek ekrandan izle. GitHub veya Vercel loguna girmen gerekmez.</p></div>
        <button onClick={load}>Yenile</button>
      </div>
      {error?<p style={{color:"crimson"}}>{error}</p>:null}
      {!data?<p>Yükleniyor…</p>:<>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginTop:16}}>
          {[["Sistem",health],["Son av",fmt(latest?.finishedAt)],["Sonraki av",nextAt?fmt(nextAt):"-"],["Pazar",marketText(latest?.market)],["Bulunan",latest?.discovered??0],["Yeni aday",latest?.newProspects??0],["Taranan",latest?.scanned??0],["Tamamlanan",latest?.completed??0],["Hata",latest?.errorCount??0]].map(([k,v])=><div key={k} className="panel" style={{padding:12}}><small style={{opacity:.65}}>{k}</small><div style={{fontWeight:800,fontSize:18,marginTop:4}}>{v}</div></div>)}
        </div>
        {parallel.length>0?<div className="panel" style={{marginTop:14,padding:14}}>
          <h3 style={{margin:"0 0 10px"}}>Bu Turda Paralel Av</h3>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:8}}>
            {parallel.map((m,i)=><div key={`${m.country}-${m.city}-${i}`} className="panel" style={{padding:10}}><small style={{opacity:.65}}>Pazar {i+1}</small><div style={{fontWeight:800,marginTop:4}}>{m.city}, {m.country}</div></div>)}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:8,marginTop:10}}>
            <div><small style={{opacity:.65}}>Paralel pazar</small><div style={{fontWeight:800,fontSize:20}}>{parallel.length}</div></div>
            <div><small style={{opacity:.65}}>Derin analiz</small><div style={{fontWeight:800,fontSize:20}}>{latest?.scanned??0}</div></div>
            <div><small style={{opacity:.65}}>Analiz başarısı</small><div style={{fontWeight:800,fontSize:20}}>%{successRate}</div></div>
          </div>
        </div>:null}
        <p style={{fontSize:13,opacity:.65,marginBottom:0}}>Saatlik hedef: 60 dk · ONLINE ölçütü: son başarılı rapor 90 dk içinde. {ageMinutes!==null?`Son rapor ${ageMinutes} dk önce.`:"Henüz başarılı çalışma raporu yok."}</p>
      </>}
    </section>

    <section className="panel" style={{marginBottom:18}}>
      <h2 style={{marginTop:0}}>Dünya Ajan Ağı</h2>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10,marginTop:12}}>
        <div className="panel" style={{padding:12}}><small style={{opacity:.65}}>Ülke Masası</small><div style={{fontWeight:800,fontSize:22,marginTop:4}}>{world?.countryCount??"-"}</div></div>
        <div className="panel" style={{padding:12}}><small style={{opacity:.65}}>Yönetim</small><div style={{fontWeight:800,marginTop:4}}>Global Baş Amir → Ülke Amirleri</div></div>
        <div className="panel" style={{padding:12}}><small style={{opacity:.65}}>Şehir Kapsamı</small><div style={{fontWeight:800,marginTop:4}}>Dinamik şehir masaları</div></div>
      </div>
      <p style={{opacity:.72,marginBottom:6}}>{world?.model}</p>
      <small style={{opacity:.65}}>{world?.cityPolicy}</small>
    </section>

    <section className="panel" style={{marginBottom:18}}>
      <h2 style={{marginTop:0}}>Global Baş Amir + Ortak Çalışma Alanı</h2>
      <p style={{opacity:.72}}><b>{data?.coordinator?.name||"Global Baş Amir Ajan"}</b> ülke amirlerini, şehir masalarını ve uzman ajanların görev devirlerini ortak panoda toplar.</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:8}}>
        {(data?.roster||[]).map(a=><div key={a} className="panel" style={{padding:10}}><b>{a}</b><small style={{display:"block",opacity:.65,marginTop:4}}>Ortak pano + koordinasyon aktif</small></div>)}
      </div>
    </section>

    <section className="panel" style={{marginBottom:18}}>
      <h2 style={{marginTop:0}}>Bugünkü / Son Paylaşımlar</h2>
      {(data?.events||[]).length===0?<p>Henüz ortak pano kaydı yok. Yeni ajan döngüsüyle kayıtlar burada oluşacak.</p>:
      <div style={{display:"grid",gap:8}}>{data.events.slice(0,30).map(e=><div key={e.id} className="panel" style={{padding:12}}><div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}><b>{e.agent} → {e.helperAgent}</b><small>{fmt(e.createdAt)}</small></div><div style={{marginTop:5}}>{e.title}</div>{e.detail?<small style={{display:"block",opacity:.7,marginTop:4}}>{e.detail}</small>:null}</div>)}</div>}
    </section>

    <SystemHealthMap/>

    <section className="panel">
      <h2 style={{marginTop:0}}>Geçmiş Günlük Raporlar</h2>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:680}}><thead><tr>{["Tarih","Pazar","Bulunan","Yeni","Tarama","Tamam","Hata"].map(x=><th key={x} style={{textAlign:"left",padding:8}}>{x}</th>)}</tr></thead><tbody>{(data?.reports||[]).map(r=><tr key={r.id}><td style={{padding:8}}>{r.reportDate}</td><td style={{padding:8}}>{marketText(r.market)}</td><td style={{padding:8}}>{r.discovered}</td><td style={{padding:8}}>{r.newProspects}</td><td style={{padding:8}}>{r.scanned}</td><td style={{padding:8}}>{r.completed}</td><td style={{padding:8}}>{r.errorCount}</td></tr>)}</tbody></table></div>
    </section>
  </div>;
}
