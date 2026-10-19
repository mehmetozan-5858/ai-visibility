"use client";
import {useEffect,useState} from "react";
import ecosystem from "../lib/ecosystem-contract.cjs";
import {currencyForCountry,formatMoney,PADDLE_SERVICE_CODES} from "../lib/regional-pricing";
import {trackAnalyticsEvent} from "../lib/analytics-client";
import {useLanguage} from "./LanguageProvider";

const sectors=["Otel / Konaklama","Restoran / Kafe","Sağlık","Hukuk","Emlak","Otomotiv","E-ticaret","Tekstil / Giyim","Eğitim","Turizm","B2B / Sanayi","Diğer"];
const sectorEnglish=["Hotel / Accommodation","Restaurant / Cafe","Healthcare","Legal services","Real estate","Automotive","E-commerce","Textiles / Clothing","Education","Tourism","B2B / Industry","Other"];
const countries=["Türkiye","United Kingdom","United States","Germany","France","Italy","Spain","Netherlands","Belgium","Austria","Ireland","Portugal","Poland","Romania","Bulgaria","Greece","Sweden","Norway","Denmark","Finland","Switzerland","Canada","Australia","United Arab Emirates","Saudi Arabia","Qatar","Japan","South Korea","India","China","Brazil","Mexico","South Africa"];
const text={
 tr:{title:"Ücretsiz ön değerlendirme başlat",help:"Ön değerlendirme başvurusu ücretsizdir; başvuru tek başına müşteri paneli hesabı açmaz. Hesap, onaylı ücretsiz pilot daveti veya yazılım planı ödemesi ve e-posta onayı sonrasında oluşturulur.",name:"Ad Soyad",business:"İşletme adı",website:"Web sitesi",country:"Ülke",city:"Şehir",sector:"Sektör",select:"Seçin",email:"E-posta",phone:"Telefon / WhatsApp",send:"Ön değerlendirme iste",sending:"Gönderiliyor…",done:"Başvuru alındı ✓",ok:"Başvurunuz alındı. İşletmeniz için uygun yazılım erişim akışı hazırlanacak.",fail:"Başvuru gönderilemedi.",countryHelp:"Ülkeniz fiyat para birimini belirler: Türkiye ₺, Avrupa €, Birleşik Krallık £, ABD ve diğer ülkeler $."},
 en:{title:"Start a free assessment",help:"The assessment request is free and does not create a portal account. Account setup follows an approved free pilot invitation or verified software-plan payment and email confirmation.",name:"Full name",business:"Business name",website:"Website",country:"Country",city:"City",sector:"Industry",select:"Select",email:"Email",phone:"Phone / WhatsApp",send:"Request assessment",sending:"Sending…",done:"Application received ✓",ok:"Your application has been received. We will prepare the appropriate software access flow for your business.",fail:"Could not submit your application.",countryHelp:"Your country determines the pricing currency: Türkiye ₺, Europe €, United Kingdom £, United States and all other countries $."}
};

const services=[...PADDLE_SERVICE_CODES];
export default function NewCustomerLeadForm({initialService="",initialCountry="",initialLanguage="",prices={}}){
  const {lang:sharedLang}=useLanguage();const lang=initialLanguage||sharedLang;const c=text[lang]||text.tr;
  const [form,setForm]=useState({name:"",businessName:"",website:"",country:initialCountry||"Türkiye",city:"",sector:"",email:"",phone:"",service:services.includes(initialService)?initialService:""});
  const [incoming,setIncoming]=useState(null);
  useEffect(()=>{
    const value=ecosystem.parse(window.location.hash);
    if(window.location.hash.startsWith("#business="))window.history.replaceState(null,"",window.location.pathname+window.location.search);
    if(value?.source==="global-broker")setIncoming(value.business);
  },[]);
  function applyIncoming(){
    if(!incoming)return;
    setForm(current=>({...current,...incoming}));setIncoming(null);
  }
  function openBroker(){
    try{window.location.assign(ecosystem.build(form,"broker"));}catch(error){setMsg(lang==="en"?"Enter your business name and a valid website before continuing.":error.message);setOk(false);}
  }
  const [busy,setBusy]=useState(false),[msg,setMsg]=useState(""),[ok,setOk]=useState(false);
  const change=(k,v)=>setForm(x=>({...x,[k]:v}));
  async function submit(e){
    e.preventDefault();setBusy(true);setMsg("");setOk(false);
    try{
      const r=await fetch("/api/leads",{method:"POST",headers:{"content-type":"application/json","accept-language":lang},body:JSON.stringify({...form,language:lang})});
      const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||c.fail);
      if(d.ok!==true||!d.lead?.id)throw new Error(c.fail);
      setOk(true);setMsg(c.ok);
      trackAnalyticsEvent("generate_lead",{service:form.service||"unspecified",country:form.country||"unspecified",language:lang});
    }catch(e){setMsg(e.message)}finally{setBusy(false)}
  }
  return <form lang={lang} data-localized className="panel scan-form" onSubmit={submit} style={{marginBottom:16}}>
    <div><h2>{c.title}</h2><p>{c.help}</p></div>
    {incoming&&<section aria-label={lang==="en"?"Business details from Global Broker":"Global Broker firma bilgileri"} style={{padding:16,border:"1px solid #3b6575",borderRadius:12}}>
      <p>{lang==="en"?"Review business details received from Global Broker:":"Global Broker’dan gelen firma bilgilerini inceleyin:"}</p>
      <dl>{Object.entries(incoming).filter(([,value])=>value).map(([key,value])=><div key={key}><dt>{({businessName:c.business,website:c.website,country:c.country,sector:c.sector})[key]}</dt><dd style={{overflowWrap:"anywhere"}}>{value}</dd></div>)}</dl>
      <button type="button" onClick={applyIncoming}>{lang==="en"?"Use these business details":"Bu firma bilgilerini kullan"}</button>
      <button type="button" onClick={()=>setIncoming(null)}>{lang==="en"?"Dismiss":"Vazgeç"}</button>
      <small style={{display:"block",marginTop:10}}>{lang==="en"?"These are user-provided details, not identity verification. Your application is sent only when you submit the form.":"Bu bilgiler kullanıcı beyanıdır; kimlik doğrulaması değildir. Başvurunuz yalnız formu gönderdiğinizde iletilir."}</small>
    </section>}
    <label>{lang==="en"?"Selected software plan":"Seçilen yazılım planı"}<select value={form.service} onChange={e=>change("service",e.target.value)} required><option value="">{lang==="en"?"Select a software plan":"Yazılım planı seçin"}</option>{(prices[currencyForCountry(form.country)]||[]).map(p=><option key={p.code} value={p.code}>{p.name} — {formatMoney(p.amount,p.currency,lang==="en"?"en-GB":"tr-TR")}{p.kind==="monthly"?(lang==="en"?" / month":" / ay"):""}</option>)}</select></label>
    <label>{c.name}<input value={form.name} onChange={e=>change("name",e.target.value)} required/></label>
    <label>{c.business}<input value={form.businessName} onChange={e=>change("businessName",e.target.value)} required/></label>
    <label>{c.website}<input value={form.website} onChange={e=>change("website",e.target.value)} placeholder="https://..." inputMode="url"/></label>
    <div className="new-customer-location-grid" style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12}}>
      <label>{c.country}<input list="aiv-country-options" value={form.country} onChange={e=>change("country",e.target.value)} required/><datalist id="aiv-country-options">{countries.map(x=><option key={x} value={x}/>)}</datalist><small>{c.countryHelp}</small></label>
      <label>{c.city}<input value={form.city} onChange={e=>change("city",e.target.value)}/></label>
    </div>
    <label>{c.sector}<select value={form.sector} onChange={e=>change("sector",e.target.value)} required><option value="">{c.select}</option>{sectors.map((x,i)=><option key={x} value={x}>{lang==="en"?sectorEnglish[i]:x}</option>)}</select></label>
    <label>{c.email}<input type="email" value={form.email} onChange={e=>change("email",e.target.value)} required autoComplete="email"/></label>
    <label>{c.phone}<input value={form.phone} onChange={e=>change("phone",e.target.value)} inputMode="tel" autoComplete="tel"/></label>
    <button disabled={busy||ok}>{busy?c.sending:ok?c.done:c.send}</button>
    <section style={{padding:16,borderTop:"1px solid #274755"}}><h3>{lang==="en"?"Explore trade opportunities":"Ticaret fırsatlarını keşfedin"}</h3>
      <p>{lang==="en"?"Continue to Global Broker with your business name, website, country and industry. Accounts and applications remain separate.":"Firma adı, site, ülke ve sektörünüzle Global Broker’a geçin. Hesaplar ve başvurular ayrı yönetilir."}</p>
      <button type="button" onClick={openBroker}>{lang==="en"?"Continue to Global Broker →":"Global Broker’a geç →"}</button>
    </section>
    {msg&&<p className="client-message" role={ok?"status":"alert"} aria-live="polite" style={{marginBottom:0}}>{msg}</p>}
    <style jsx>{`@media (max-width:640px){.new-customer-location-grid{grid-template-columns:1fr!important;}}`}</style>
  </form>;
}
