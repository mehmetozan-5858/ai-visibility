"use client";
import {useEffect,useMemo,useState} from "react";

export default function CreatorOperations(){
  const [data,setData]=useState({profiles:[],accounts:[],findings:[],tasks:[]});
  const [hunt,setHunt]=useState({leads:[]});
  const [selected,setSelected]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const refresh=async()=>{setLoading(true);setError("");try{const r=await fetch("/api/creator-workspace",{cache:"no-store"});const j=await r.json();if(!r.ok)throw new Error(j.error||"Yüklenemedi");setData(j);if(!selected&&j.profiles?.[0]?.id)setSelected(j.profiles[0].id)}catch(e){setError(e.message)}finally{setLoading(false)}};
  useEffect(()=>{refresh();fetch("/api/creator-hunt-leads",{cache:"no-store"}).then(r=>r.json()).then(j=>setHunt(j)).catch(()=>{})},[]);
  const profile=useMemo(()=>data.profiles.find(x=>x.id===selected),[data.profiles,selected]);
  const accounts=data.accounts.filter(x=>x.profileId===selected);
  const findings=data.findings.filter(x=>x.profileId===selected);
  const tasks=data.tasks.filter(x=>x.profileId===selected);
  const runSolutions=async()=>{if(!selected)return;setLoading(true);setError("");try{const r=await fetch("/api/creator-workspace",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"generate-solutions",profileId:selected})});const j=await r.json();if(!r.ok)throw new Error(j.error||"Çözüm görevleri üretilemedi");await refresh()}catch(e){setError(e.message);setLoading(false)}};
  const updateTask=async(id,status)=>{setLoading(true);try{await fetch("/api/creator-workspace",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"update-task",id,status})});await refresh()}finally{setLoading(false)}};
  return <div style={{display:"grid",gap:14}}>
    <section className="panel"><h3 style={{margin:"0 0 6px"}}>Creator Av Canlı Havuzu</h3><p style={{margin:"0 0 12px",opacity:.72}}>YouTube, Instagram, TikTok, X, LinkedIn ve Facebook üzerinde bulunan kamuya açık creator fırsatları.</p><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10}}><div><small>Bulunan creator</small><h2 style={{margin:"4px 0"}}>{hunt.leads?.length||0}</h2></div><div><small>Yüksek fırsat</small><h2 style={{margin:"4px 0"}}>{hunt.leads?.filter(x=>x.opportunityScore>=75).length||0}</h2></div></div>{hunt.leads?.slice(0,8).map(x=><div key={x.id} style={{padding:"10px 0",borderTop:"1px solid rgba(148,163,184,.18)"}}><strong>{x.displayName}</strong><div style={{fontSize:13,opacity:.72}}>{x.platform} · {x.country} · {x.niche} · Fırsat {x.opportunityScore}/100</div></div>)}</section>
    <section className="panel">
      <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}>
        <div><h3 style={{margin:"0 0 5px"}}>Creator Operasyon Masası</h3><p style={{margin:0,opacity:.72}}>Creator profilleri, platform hesapları, bulgular ve rapor sonrası çözüm görevlerinin kalıcı çalışma alanı.</p></div>
        <button type="button" onClick={refresh} disabled={loading}>{loading?"Kontrol ediliyor…":"Yenile"}</button>
      </div>
      {error?<p style={{marginBottom:0}}>{error}</p>:null}
    </section>

    <section className="panel">
      <label style={{display:"grid",gap:7,maxWidth:520}}><strong>Creator / Personal Brand</strong><select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Profil seç</option>{data.profiles.map(p=><option key={p.id} value={p.id}>{p.displayName}{p.niche?` — ${p.niche}`:""}</option>)}</select></label>
      {!data.profiles.length?<p style={{opacity:.7,marginBottom:0}}>Henüz creator profili yok. Altyapı hazır; ilk müşteri/creator eklendiğinde kayıtlar burada çalışacak.</p>:null}
    </section>

    {profile?<>
      <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12}}>
        <article className="panel"><small>Platform hesapları</small><h2 style={{margin:"6px 0 0"}}>{accounts.length}</h2></article>
        <article className="panel"><small>Açık bulgular</small><h2 style={{margin:"6px 0 0"}}>{findings.filter(x=>x.status==="open").length}</h2></article>
        <article className="panel"><small>Çözüm görevleri</small><h2 style={{margin:"6px 0 0"}}>{tasks.length}</h2></article>
        <article className="panel"><small>Tamamlanan</small><h2 style={{margin:"6px 0 0"}}>{tasks.filter(x=>x.status==="completed").length}</h2></article>
      </section>

      <section className="panel">
        <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}><div><h3 style={{margin:"0 0 5px"}}>Rapor Sonrası Çözüm Kuyruğu</h3><p style={{margin:0,opacity:.72}}>Açık bulgular çözüm ajanlarına dağıtılır; tekrar üretimde aynı bulgu için çift görev açılmaz.</p></div><button type="button" onClick={runSolutions} disabled={loading||!findings.length}>Çözüm görevlerini üret</button></div>
      </section>

      <section style={{display:"grid",gap:10}}>{tasks.length?tasks.map(t=><article className="panel" key={t.id}><div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start",flexWrap:"wrap"}}><div><div style={{fontSize:12,opacity:.6,textTransform:"uppercase"}}>{t.platform} · {t.agentName}</div><h3 style={{margin:"4px 0 6px"}}>{t.title}</h3><p style={{margin:0,opacity:.75}}>{t.detail}</p></div><div style={{display:"grid",gap:7,minWidth:150}}><span className={t.status==="completed"?"ready":"waiting"}>{t.status}</span>{t.status!=="completed"?<button type="button" onClick={()=>updateTask(t.id,"completed")}>Tamamlandı</button>:null}</div></div></article>):<div className="panel" style={{opacity:.7}}>Bu profil için henüz çözüm görevi yok.</div>}</section>
    </>:null}
  </div>;
}
