"use client";
import {useEffect,useState} from "react";
import {formatMoney} from "../lib/regional-pricing";

const labels={new:"Yeni",contacted:"İletişim kuruldu",qualified:"Nitelikli",proposal:"Teklif",won:"Müşteri oldu",lost:"Kapandı"};
function serviceLabel(service){return service?service.name+" · "+formatMoney(service.amount,service.currency,"tr-TR")+(service.kind==="monthly"?" / ay":service.kind==="from"?" başlangıç"):"Belirtilmedi"}

export default function LeadsManager(){
  const [items,setItems]=useState([]),[busy,setBusy]=useState(""),[msg,setMsg]=useState("");
  const [loading,setLoading]=useState(true),[loadError,setLoadError]=useState(false);
  async function load(){
    setLoading(true);setLoadError(false);
    try{
      const r=await fetch("/api/leads",{cache:"no-store"});
      const d=await r.json().catch(()=>({}));
      if(!r.ok||!Array.isArray(d.leads))throw new Error(d.error||"Başvurular yüklenemedi.");
      setItems(d.leads);
    }catch(e){setLoadError(true);setMsg(e.message||"Başvurular yüklenemedi.")}
    finally{setLoading(false)}
  }
  useEffect(()=>{load()},[]);
  async function convert(id){setBusy(id);setMsg("");try{const r=await fetch("/api/leads",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({id})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Dönüştürülemedi.");setMsg("Müşteri oluşturuldu; seçilen paket ve ülke ödeme bağlantısına bağlandı.");if(d.paymentUrl)window.open(d.paymentUrl,"_blank");await load()}catch(e){setMsg(e.message)}finally{setBusy("")}}
  async function update(id,status){
    setBusy(id);setMsg("");
    try{
      const r=await fetch("/api/leads",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id,status})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"Güncellenemedi.");
      await load();
    }catch(e){setMsg(e.message)}finally{setBusy("")}
  }
  return <section className="panel">
    <div className="section-title"><div><h2>Yeni Müşteri Başvuruları</h2><small>Web sitesinden gelen ön değerlendirme talepleri</small></div></div>
    {msg&&<p className="client-message">{msg}</p>}
    {loading&&<p>Başvurular yükleniyor…</p>}
    {loadError&&<button onClick={()=>{setMsg("");load()}}>Başvuruları yeniden yükle</button>}
    {!items.length?(!loading&&!loadError&&<div className="empty">Henüz yeni müşteri başvurusu yok.</div>):<div className="client-list">{items.map(x=><article className="client-row" key={x.id}>
      <div className="client-avatar">{String(x.businessName||"?").slice(0,1).toUpperCase()}</div>
      <div><b>{x.businessName}</b><small>{x.name} · {x.email}{x.phone?" · "+x.phone:""}</small><small>{[x.country,x.city,x.sector].filter(Boolean).join(" · ")}{x.website?" · "+x.website:""}</small><small style={{fontWeight:700,color:"#73d9bd"}}>İstenen hizmet: {serviceLabel(x.service)}</small></div>
      <span>{labels[x.status]||x.status}</span>
      <button onClick={()=>convert(x.id)} disabled={busy===x.id}>{busy===x.id?"Hazırlanıyor…":"Müşteri + ödeme"}</button>
      <select value={x.status} disabled={busy===x.id} onChange={e=>update(x.id,e.target.value)} style={{background:"#071923",color:"#fff",border:"1px solid #24506a",borderRadius:10,padding:"9px"}}>
        {Object.entries(labels).map(([k,v])=><option key={k} value={k}>{v}</option>)}
      </select>
    </article>)}</div>}
  </section>;
}
