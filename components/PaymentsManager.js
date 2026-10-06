"use client";
import PilotAccessManager from "./PilotAccessManager";
import {useEffect,useState} from "react";

function money(amount,currency){return ["TRY","EUR","USD","GBP"].includes(currency)?new Intl.NumberFormat("tr-TR",{style:"currency",currency}).format(amount):`${amount} (para birimi eksik)`;}

function BankReviewForm({row,busy,onSave,onCancel}){
 const [amount,setAmount]=useState(''),[currency,setCurrency]=useState(''),[invoiceReference,setInvoiceReference]=useState(''),[bankReference,setBankReference]=useState(''),[valueDate,setValueDate]=useState(''),[confirmed,setConfirmed]=useState(false);
 return <form className="panel" onSubmit={e=>{e.preventDefault();onSave({amount,currency,invoiceReference,bankReference,valueDate,confirmed})}}><h3>{row.clientName} · Banka tahsilat kontrolü</h3><p>Beklenen: {money(Number(row.setupAmount)+Number(row.monthlyAmount),row.currency)} · {row.referenceCode}</p><p>Banka hesabınızda görünen bilgileri aşağıya girin. Dekont veya müşteri bildirimi tek başına banka doğrulaması değildir.</p><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,230px),1fr))',gap:12}}><label>Tahsil edilen tutar<input required inputMode="decimal" placeholder="Örn. 4990,00" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>Hesaba gelen para birimi<select required value={currency} onChange={e=>setCurrency(e.target.value)}><option value="">Seçin</option>{['TRY','USD','EUR','GBP'].map(x=><option key={x}>{x}</option>)}</select></label><label>Ödeme açıklamasındaki AIV kodu<input required value={invoiceReference} onChange={e=>setInvoiceReference(e.target.value)} maxLength={60}/></label><label>Bankanın işlem referansı<input required value={bankReference} onChange={e=>setBankReference(e.target.value)} minLength={6} maxLength={120}/></label><label>Tahsilat tarihi<input required type="date" value={valueDate} onChange={e=>setValueDate(e.target.value)}/></label></div><label style={{display:'flex',gap:8,margin:'14px 0'}}><input required type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Paranın banka hesabına geçtiğini ve bu müşteriyle eşleştiğini kontrol ettim.</label><small>Bu kayıt manuel banka kontrolüdür. Otomatik banka bağlantısı kullanılmaz.</small><div style={{display:'flex',gap:10,marginTop:12}}><button disabled={busy||!confirmed}>Kontrolü kaydet ve paketi aktive et</button><button type="button" disabled={busy} onClick={onCancel}>Vazgeç</button></div></form>;
}
export default function PaymentsManager(){
  const [rows,setRows]=useState([]),[busy,setBusy]=useState(""),[msg,setMsg]=useState(""),[testBusy,setTestBusy]=useState(false),[review,setReview]=useState(null);
  async function load(){
    const r=await fetch("/api/admin-payments",{cache:"no-store"}),d=await r.json();
    if(r.ok)setRows(d.payments||[]);
  }
  useEffect(()=>{load()},[]);
  async function confirm(row,bankEvidence){
    if(!["TRY","EUR","USD","GBP"].includes(row.currency)){setMsg("Para birimi eksik; ödeme onaylanamaz.");return;}
    setBusy(row.id);setMsg("");
    try{
      const r=await fetch("/api/admin-payments",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({
        id:row.id,bankVerified:true,bankEvidence
      })});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"Onaylanamadı.");
      setReview(null);setMsg(row.clientName+" ödemesi onaylandı ve banka kontrol kaydı saklandı.");await load();
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
    <PilotAccessManager/>
    {msg&&<p className="client-message" role="status">{msg}</p>}
    {review&&<BankReviewForm key={review.id} row={review} busy={busy===review.id} onCancel={()=>setReview(null)} onSave={evidence=>confirm(review,evidence)}/>}
    {!rows.length?<div className="empty">Henüz ödeme kaydı yok.</div>:<div className="client-list">{rows.map(x=><article className="client-row" key={x.id}>
      <div className="client-avatar">{x.currency||"?"}</div>
      <div><b>{x.clientName}</b><small>{x.referenceCode} · {x.status==="customer-reported"?"Müşteri ödeme bildirdi":x.status==="paid"?"Onaylandı":"Ödeme bekleniyor"}</small></div>
      <span>{x.status==="paid"?(money(x.setupAmount+x.monthlyAmount,x.currency)+(x.monthlyAmount?" / ilk ay":" / tek sefer")):x.plan}</span>
      {x.status==="paid"?<div><em>Onaylandı</em>{x.method==="bank-transfer"&&<button type="button" disabled={busy===x.id} onClick={()=>reverse(x)}>Yanlış onayı geri al</button>}</div>:<div style={{display:"grid",gap:6,minWidth:150}}>
        <small>{money(x.setupAmount+x.monthlyAmount,x.currency)} · {x.monthlyAmount?"İlk ay ödemesi":"Tek seferlik ödeme"}</small>
        <button disabled={busy===x.id||x.status!=="customer-reported"||x.method!=="bank-transfer"} onClick={()=>setReview(x)}>{busy===x.id?"Onaylanıyor…":x.status==="customer-reported"?"Ödemeyi onayla":"Bildirim bekleniyor"}</button>
      </div>}
    </article>)}</div>}
  </section>;
}
