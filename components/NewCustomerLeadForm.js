"use client";
import {useState} from "react";

const sectors=["Otel / Konaklama","Restoran / Kafe","Sağlık","Hukuk","Emlak","Otomotiv","E-ticaret","Tekstil / Giyim","Eğitim","Turizm","B2B / Sanayi","Diğer"];

export default function NewCustomerLeadForm(){
  const [form,setForm]=useState({name:"",businessName:"",website:"",country:"Türkiye",city:"",sector:"",email:"",phone:""});
  const [busy,setBusy]=useState(false),[msg,setMsg]=useState(""),[ok,setOk]=useState(false);
  const change=(k,v)=>setForm(x=>({...x,[k]:v}));
  async function submit(e){
    e.preventDefault();setBusy(true);setMsg("");setOk(false);
    try{
      const r=await fetch("/api/leads",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(form)});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"Başvuru gönderilemedi.");
      setOk(true);setMsg("Başvurunuz alındı. İşletmenizi inceleyip size uygun analiz ve teklif süreci hazırlanacak.");
    }catch(e){setMsg(e.message)}finally{setBusy(false)}
  }
  return <form className="panel scan-form" onSubmit={submit} style={{marginBottom:16}}>
    <div><h2>Ücretsiz ön değerlendirme başlat</h2><p>İşletme bilgilerinizi bırakın; ilk görünürlük kontrolü ve uygun paket süreci için kayıt oluşturalım.</p></div>
    <label>Ad Soyad<input value={form.name} onChange={e=>change("name",e.target.value)} required/></label>
    <label>İşletme adı<input value={form.businessName} onChange={e=>change("businessName",e.target.value)} required/></label>
    <label>Web sitesi<input value={form.website} onChange={e=>change("website",e.target.value)} placeholder="https://..." inputMode="url"/></label>
    <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12}}>
      <label>Ülke<input value={form.country} onChange={e=>change("country",e.target.value)}/></label>
      <label>Şehir<input value={form.city} onChange={e=>change("city",e.target.value)}/></label>
    </div>
    <label>Sektör<select value={form.sector} onChange={e=>change("sector",e.target.value)} required><option value="">Seçin</option>{sectors.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
    <label>E-posta<input type="email" value={form.email} onChange={e=>change("email",e.target.value)} required autoComplete="email"/></label>
    <label>Telefon / WhatsApp<input value={form.phone} onChange={e=>change("phone",e.target.value)} inputMode="tel" autoComplete="tel"/></label>
    <button disabled={busy||ok}>{busy?"Gönderiliyor…":ok?"Başvuru alındı ✓":"Ön değerlendirme iste"}</button>
    {msg&&<p className="client-message" style={{marginBottom:0}}>{msg}</p>}
  </form>;
}
