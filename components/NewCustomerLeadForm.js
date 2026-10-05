"use client";
import {useState} from "react";
import {useLanguage} from "./LanguageProvider";

const sectors=["Otel / Konaklama","Restoran / Kafe","Sağlık","Hukuk","Emlak","Otomotiv","E-ticaret","Tekstil / Giyim","Eğitim","Turizm","B2B / Sanayi","Diğer"];
const countries=["Türkiye","United Kingdom","United States","Germany","France","Italy","Spain","Netherlands","Belgium","Austria","Ireland","Portugal","Poland","Romania","Bulgaria","Greece","Sweden","Norway","Denmark","Finland","Switzerland","Canada","Australia","United Arab Emirates","Saudi Arabia","Qatar","Japan","South Korea","India","China","Brazil","Mexico","South Africa"];
const text={
 tr:{title:"Ücretsiz ön değerlendirme başlat",help:"İşletme bilgilerinizi bırakın; ilk görünürlük kontrolü ve uygun paket süreci için kayıt oluşturalım.",name:"Ad Soyad",business:"İşletme adı",website:"Web sitesi",country:"Ülke",city:"Şehir",sector:"Sektör",select:"Seçin",email:"E-posta",phone:"Telefon / WhatsApp",send:"Ön değerlendirme iste",sending:"Gönderiliyor…",done:"Başvuru alındı ✓",ok:"Başvurunuz alındı. İşletmenizi inceleyip size uygun analiz ve teklif süreci hazırlanacak.",fail:"Başvuru gönderilemedi.",countryHelp:"Ülkeniz fiyat para birimini belirler: Türkiye ₺, Avrupa €, Birleşik Krallık £, ABD ve diğer ülkeler $."},
 en:{title:"Start a free assessment",help:"Share your business details to begin the visibility review and package process.",name:"Full name",business:"Business name",website:"Website",country:"Country",city:"City",sector:"Industry",select:"Select",email:"Email",phone:"Phone / WhatsApp",send:"Request assessment",sending:"Sending…",done:"Application received ✓",ok:"Your application has been received. We will review your business and prepare the appropriate analysis and offer process.",fail:"Could not submit your application.",countryHelp:"Your country determines the pricing currency: Türkiye ₺, Europe €, United Kingdom £, United States and all other countries $."}
};

const services={
 "business-diagnosis":"AI Visibility Analizi + Rapor — 4.990 TL",
 "business-solution":"Çözüm / Uygulama Paketi — 19.900 TL'den başlayan",
 "business-monitoring":"Sürekli Takip + Optimizasyon — 6.990 TL / ay"
};
export default function NewCustomerLeadForm({initialService=""}){
  const {lang}=useLanguage();const c=text[lang]||text.tr;
  const [form,setForm]=useState({name:"",businessName:"",website:"",country:"Türkiye",city:"",sector:"",email:"",phone:"",service:services[initialService]?initialService:""});
  const [busy,setBusy]=useState(false),[msg,setMsg]=useState(""),[ok,setOk]=useState(false);
  const change=(k,v)=>setForm(x=>({...x,[k]:v}));
  async function submit(e){
    e.preventDefault();setBusy(true);setMsg("");setOk(false);
    try{
      const r=await fetch("/api/leads",{method:"POST",headers:{"content-type":"application/json","accept-language":lang},body:JSON.stringify({...form,language:lang})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||c.fail);
      setOk(true);setMsg(c.ok);
    }catch(e){setMsg(e.message)}finally{setBusy(false)}
  }
  return <form className="panel scan-form" onSubmit={submit} style={{marginBottom:16}}>
    <div><h2>{c.title}</h2><p>{c.help}</p></div>
    <label>Seçilen hizmet<select value={form.service} onChange={e=>change("service",e.target.value)} required><option value="">Hizmet seçin</option>{Object.entries(services).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
    <label>{c.name}<input value={form.name} onChange={e=>change("name",e.target.value)} required/></label>
    <label>{c.business}<input value={form.businessName} onChange={e=>change("businessName",e.target.value)} required/></label>
    <label>{c.website}<input value={form.website} onChange={e=>change("website",e.target.value)} placeholder="https://..." inputMode="url"/></label>
    <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12}}>
      <label>{c.country}<input list="aiv-country-options" value={form.country} onChange={e=>change("country",e.target.value)} required/><datalist id="aiv-country-options">{countries.map(x=><option key={x} value={x}/>)}</datalist><small>{c.countryHelp}</small></label>
      <label>{c.city}<input value={form.city} onChange={e=>change("city",e.target.value)}/></label>
    </div>
    <label>{c.sector}<select value={form.sector} onChange={e=>change("sector",e.target.value)} required><option value="">{c.select}</option>{sectors.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
    <label>{c.email}<input type="email" value={form.email} onChange={e=>change("email",e.target.value)} required autoComplete="email"/></label>
    <label>{c.phone}<input value={form.phone} onChange={e=>change("phone",e.target.value)} inputMode="tel" autoComplete="tel"/></label>
    <button disabled={busy||ok}>{busy?c.sending:ok?c.done:c.send}</button>
    {msg&&<p className="client-message" style={{marginBottom:0}}>{msg}</p>}
  </form>;
}
