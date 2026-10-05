"use client";
import {useEffect,useState} from "react";
export default function ExecutiveDailyReport(){
 const [d,setD]=useState(null),[err,setErr]=useState("");
 const load=()=>fetch("/api/executive-daily-report",{cache:"no-store"}).then(r=>r.json()).then(x=>{if(x.error)throw new Error(x.error);setD(x)}).catch(e=>setErr(e.message));
 useEffect(()=>{load()},[]);
 if(err)return <section className="panel"><h3>Gün Sonu Yönetici Raporu</h3><p>{err}</p></section>;
 if(!d)return <section className="panel"><h3>Gün Sonu Yönetici Raporu</h3><p>Rapor hazırlanıyor…</p></section>;
 const f=d.funnel||{},p=f.prospects||{},pay=f.payments||{},work=f.work||{},re=f.remeasurement||{};
 const cards=[["Bulunan aday",p.total||0],["Nitelikli",p.qualified||0],["Temas",p.contacted||0],["Cevap",p.replies||0],["Teklif",p.proposals||0],["Satış",p.won||0],["Ödenen",pay.paid||0],["Gelir",Number(pay.revenue||0).toLocaleString("tr-TR")],["Çözüm tamamlandı",work.completed||0],["Bloke iş",work.blocked||0],["İyileşen",re.improved||0],["Ort. skor değişimi",Number(re.avgDelta||0).toFixed(1)]];
 return <section className="panel"><div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}><div><h2 style={{margin:"0 0 4px"}}>Gün Sonu Yönetici Raporu</h2><div style={{opacity:.7}}>{d.date} · Business + Creator + Ajan Amirleri</div></div><button onClick={load}>Yenile</button></div>
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginTop:14}}>{cards.map(([k,v])=><div key={k} style={{padding:12,border:"1px solid rgba(148,163,184,.22)",borderRadius:14}}><small style={{opacity:.7}}>{k}</small><h2 style={{margin:"5px 0 0"}}>{v}</h2></div>)}</div>
 <h3>Dönüşüm Hunisi</h3><p>Nitelik %{d.conversion?.qualifiedRate||0} · Cevap %{d.conversion?.replyRate||0} · Tekliften satış %{d.conversion?.winRate||0}</p>
 <h3>Öngörülen Riskler</h3>{d.risks?.length?d.risks.slice(0,8).map(x=><div key={x.clientId} style={{padding:"8px 0",borderTop:"1px solid rgba(148,163,184,.15)"}}><strong>{x.name}</strong> — {x.blocked} iş erişim/onay bekliyor.</div>):<p>Aktif uygulama blokajı yok.</p>}
 <h3>Av Bölgeleri</h3><p>{d.markets.length?d.markets.map(x=>[x.country,x.city].filter(Boolean).join(" / ")).join(" · "):"Henüz kayıt yok."}</p>
 <h3>Creator Platformları</h3><p>{d.creator.platforms.length?d.creator.platforms.join(" · "):"Henüz kayıt yok."}</p>
 <h3>Çalışan Ajan / Amirler</h3><p>{d.agents.length?d.agents.join(" · "):"Henüz kayıt yok."}</p>
 <h3>Son Ajan Hareketleri</h3>{d.events.slice(0,12).map(x=><div key={x.id} style={{padding:"9px 0",borderTop:"1px solid rgba(148,163,184,.15)"}}><strong>{x.agent}</strong> — {x.title}<div style={{fontSize:13,opacity:.68}}>{x.detail}</div></div>)}
 </section>
}
