"use client";
import {useEffect,useMemo,useState} from "react";

function fmt(v){if(!v)return "-";try{return new Date(v).toLocaleString("tr-TR")}catch{return String(v)}}
function marketText(m){return [m?.city,m?.country].filter(Boolean).join(", ")||"-"}

export default function AgentCenter(){
  const [data,setData]=useState(null),[error,setError]=useState("");
  const load=()=>fetch("/api/agent-center",{cache:"no-store"}).then(async r=>{if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||"Yüklenemedi");return r.json()}).then(setData).catch(e=>setError(e.message));
  useEffect(()=>{load()},[]);
  const latest=data?.latest;
  const health=useMemo(()=>!latest?"Bekleniyor":latest.errorCount>0?"Dikkat":latest.completed>0?"Sağlıklı":"Çalıştı / sonuç yok",[latest]);
  const world=data?.worldNetwork;
  return <div>
    <section className="panel" style={{marginBottom:18}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start",flexWrap:"wrap"}}>
        <div><h2 style={{marginTop:0}}>Ajan Günlük Raporu</h2><p style={{marginBottom:0,opacity:.72}}>Tüm ajanların günlük ortak çalışma özeti. Vercel loguna girmen gerekmez.</p></div>
        <button onClick={load}>Yenile</button>
      </div>
      {error?<p style={{color:"crimson"}}>{error}</p>:null}
      {!data?<p>Yükleniyor…</p>:<>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginTop:16}}>
          {[["Durum",health],["Pazar",marketText(latest?.market)],["Bulunan",latest?.discovered??0],["Yeni aday",latest?.newProspects??0],["Taranan",latest?.scanned??0],["Tamamlanan",latest?.completed??0],["Hata",latest?.errorCount??0]].map(([k,v])=><div key={k} className="panel" style={{padding:12}}><small style={{opacity:.65}}>{k}</small><div style={{fontWeight:800,fontSize:18,marginTop:4}}>{v}</div></div>)}
        </div>
        <p style={{fontSize:13,opacity:.65,marginBottom:0}}>Son çalışma: {fmt(latest?.finishedAt)}</p>
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

    <section className="panel">
      <h2 style={{marginTop:0}}>Geçmiş Günlük Raporlar</h2>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:680}}><thead><tr>{["Tarih","Pazar","Bulunan","Yeni","Tarama","Tamam","Hata"].map(x=><th key={x} style={{textAlign:"left",padding:8}}>{x}</th>)}</tr></thead><tbody>{(data?.reports||[]).map(r=><tr key={r.id}><td style={{padding:8}}>{r.reportDate}</td><td style={{padding:8}}>{marketText(r.market)}</td><td style={{padding:8}}>{r.discovered}</td><td style={{padding:8}}>{r.newProspects}</td><td style={{padding:8}}>{r.scanned}</td><td style={{padding:8}}>{r.completed}</td><td style={{padding:8}}>{r.errorCount}</td></tr>)}</tbody></table></div>
    </section>
  </div>;
}
