"use client";
import {useEffect,useState} from "react";

export default function PaymentsManager(){
  const [rows,setRows]=useState([]),[busy,setBusy]=useState(""),[msg,setMsg]=useState(""),[amounts,setAmounts]=useState({});
  async function load(){
    const r=await fetch("/api/admin-payments",{cache:"no-store"}),d=await r.json();
    if(r.ok)setRows(d.payments||[]);
  }
  useEffect(()=>{load()},[]);
  function setVal(id,key,value){setAmounts(x=>({...x,[id]:{...(x[id]||{}),[key]:value}}))}
  async function confirm(row){
    const a=amounts[row.id]||{};
    if(!a.monthlyAmount){setMsg("Aylık tutarı TL olarak girin.");return}
    setBusy(row.id);setMsg("");
    try{
      const r=await fetch("/api/admin-payments",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({
        id:row.id,plan:a.plan||row.plan||"Starter",setupAmount:a.setupAmount||0,monthlyAmount:a.monthlyAmount
      })});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"Onaylanamadı.");
      setMsg(row.clientName+" ödemesi onaylandı ve paket aktif edildi.");await load();
    }catch(e){setMsg(e.message)}finally{setBusy("")}
  }
  return <section className="panel">
    <div className="section-title"><div><h2>Ödeme Onay Merkezi</h2><small>Havale/EFT bildirimlerini banka kontrolünden sonra aktive edin</small></div></div>
    {msg&&<p className="client-message">{msg}</p>}
    {!rows.length?<div className="empty">Henüz ödeme kaydı yok.</div>:<div className="client-list">{rows.map(x=><article className="client-row" key={x.id}>
      <div className="client-avatar">₺</div>
      <div><b>{x.clientName}</b><small>{x.referenceCode} · {x.status==="customer-reported"?"Müşteri ödeme bildirdi":x.status==="paid"?"Onaylandı":"Ödeme bekleniyor"}</small></div>
      <span>{x.status==="paid"?(x.monthlyAmount+" TL/ay"):x.plan}</span>
      {x.status==="paid"?<em>Aktif</em>:<div style={{display:"grid",gap:6,minWidth:150}}>
        <input inputMode="numeric" placeholder="Kurulum TL" value={amounts[x.id]?.setupAmount||""} onChange={e=>setVal(x.id,"setupAmount",e.target.value)} style={{background:"#071923",color:"#fff",border:"1px solid #24506a",borderRadius:9,padding:8}}/>
        <input inputMode="numeric" placeholder="Aylık TL" value={amounts[x.id]?.monthlyAmount||""} onChange={e=>setVal(x.id,"monthlyAmount",e.target.value)} style={{background:"#071923",color:"#fff",border:"1px solid #24506a",borderRadius:9,padding:8}}/>
        <button disabled={busy===x.id||x.status!=="customer-reported"} onClick={()=>confirm(x)}>{busy===x.id?"Onaylanıyor…":x.status==="customer-reported"?"Ödemeyi onayla":"Bildirim bekleniyor"}</button>
      </div>}
    </article>)}</div>}
  </section>;
}
