"use client";
import {useEffect,useState} from "react";

function money(amount,currency){return ["TRY","EUR","USD","GBP"].includes(currency)?new Intl.NumberFormat("tr-TR",{style:"currency",currency}).format(amount):`${amount} (para birimi eksik)`;}

export default function PaymentsManager(){
  const [rows,setRows]=useState([]),[busy,setBusy]=useState(""),[msg,setMsg]=useState(""),[testBusy,setTestBusy]=useState(false);
  async function load(){
    const r=await fetch("/api/admin-payments",{cache:"no-store"}),d=await r.json();
    if(r.ok)setRows(d.payments||[]);
  }
  useEffect(()=>{load()},[]);
  async function confirm(row){
    if(!["TRY","EUR","USD","GBP"].includes(row.currency)){setMsg("Para birimi eksik; ödeme onaylanamaz.");return;}
    if(!window.confirm(row.clientName+" · "+money(row.setupAmount+row.monthlyAmount,row.currency)+" tahsilatını banka hesabında doğruladınız mı?"))return;
    setBusy(row.id);setMsg("");
    try{
      const r=await fetch("/api/admin-payments",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({
        id:row.id,bankVerified:true
      })});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"Onaylanamadı.");
      setMsg(row.clientName+" ödemesi onaylandı ve paket aktif edildi.");await load();
    }catch(e){setMsg(e.message)}finally{setBusy("")}
  }
  async function reverse(row){
    if(!window.confirm(row.clientName+" için yanlış ödeme onayını geri al? Başka onaylı ödeme yoksa hizmet erişimi durdurulur."))return;
    const reason=window.prompt("Geri alma gerekçesi", "Ödeme gelmeden yanlışlıkla onay verildi.");
    if(!reason)return;
    setBusy(row.id);setMsg("");
    try{
      const r=await fetch("/api/admin-payments",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id:row.id,action:"reverse",reason})});
      const d=await r.json();if(!r.ok)throw Error(d.error||"Geri alınamadı.");
      setMsg(row.clientName+" ödeme onayı geri alındı; banka kontrolü bekleniyor.");await load();
    }catch(e){setMsg(e.message)}finally{setBusy("")}
  }
  async function startSafeTest(){
    setTestBusy(true);setMsg("");
    try{
      const r=await fetch("/api/admin-test-flow",{method:"POST"});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"Test akışı hazırlanamadı.");
      window.location.href=d.paymentUrl;
    }catch(e){setMsg(e.message)}finally{setTestBusy(false)}
  }
  return <section className="panel">
    <div className="section-title"><div><h2>Ödeme Onay Merkezi</h2><small>Havale/EFT bildirimlerini banka kontrolünden sonra aktive edin</small></div></div>
    <div className="content-plan" style={{marginBottom:16}}>
      <b>Güvenli test modu</b>
      <p>Gerçek müşteriyi veya gerçek banka hareketini değiştirmeden ödeme onayı → müşteri hesabı → müşteri paneli akışını test eder.</p>
      <button type="button" onClick={startSafeTest} disabled={testBusy}>{testBusy?"Test hazırlanıyor…":"Test müşterisiyle uçtan uca dene"}</button>
    </div>
    {msg&&<p className="client-message">{msg}</p>}
    {!rows.length?<div className="empty">Henüz ödeme kaydı yok.</div>:<div className="client-list">{rows.map(x=><article className="client-row" key={x.id}>
      <div className="client-avatar">{x.currency||"?"}</div>
      <div><b>{x.clientName}</b><small>{x.referenceCode} · {x.status==="customer-reported"?"Müşteri ödeme bildirdi":x.status==="paid"?"Onaylandı":"Ödeme bekleniyor"}</small></div>
      <span>{x.status==="paid"?(money(x.setupAmount+x.monthlyAmount,x.currency)+(x.monthlyAmount?" / ilk ay":" / tek sefer")):x.plan}</span>
      {x.status==="paid"?<div><em>Onaylandı</em>{x.method==="bank-transfer"&&<button type="button" disabled={busy===x.id} onClick={()=>reverse(x)}>Yanlış onayı geri al</button>}</div>:<div style={{display:"grid",gap:6,minWidth:150}}>
        <small>{money(x.setupAmount+x.monthlyAmount,x.currency)} · {x.monthlyAmount?"İlk ay ödemesi":"Tek seferlik ödeme"}</small>
        <button disabled={busy===x.id||x.status!=="customer-reported"} onClick={()=>confirm(x)}>{busy===x.id?"Onaylanıyor…":x.status==="customer-reported"?"Ödemeyi onayla":"Bildirim bekleniyor"}</button>
      </div>}
    </article>)}</div>}
  </section>;
}
