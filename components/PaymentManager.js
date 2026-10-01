"use client";
import {useEffect,useState} from "react";
export default function PaymentManager({clientId}){
  const [d,setD]=useState(null),[err,setErr]=useState(""),[copied,setCopied]=useState(false);
  useEffect(()=>{fetch("/api/payment?clientId="+encodeURIComponent(clientId),{cache:"no-store"}).then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error||"Ödeme bilgisi alınamadı.");return j}).then(setD).catch(e=>setErr(e.message))},[clientId]);
  if(err)return <section className="panel"><p className="client-message">{err}</p></section>;
  if(!d)return <section className="panel"><p>Ödeme bilgileri hazırlanıyor…</p></section>;
  const ref=("AIV-"+d.client.id.slice(0,8)).toUpperCase();
  const rawIban=String(d.bank?.iban||"").replace(/\s+/g,"");
  const maskedIban=rawIban?("TR** **** **** **** **** **"+rawIban.slice(-4)):"";
  async function copyIban(){
    try{
      await navigator.clipboard.writeText(rawIban);
      setCopied(true);
      setTimeout(()=>setCopied(false),1800);
    }catch{
      setErr("IBAN kopyalanamadı. Tarayıcı pano izni vermedi.");
    }
  }
  return <section className="grid reports-grid">
    <article className="panel">
      <h2>Paket seçimi</h2><p><b>{d.client.name}</b> için önerilen paket</p>
      <div className="content-plan"><h3>{d.plan.name}</h3><ul>
        <li>Kurulum: {d.plan.setup}</li><li>Aylık: {d.plan.monthly}</li>
        <li>ChatGPT + Gemini + Perplexity görünürlük takibi</li><li>GEO/AEO iyileştirme planı</li><li>Aylık görünürlük raporu</li>
      </ul></div>
    </article>
    <article className="panel">
      <h2>Havale / EFT</h2>
      {d.transferReady?<div className="content-plan">
        <b>Banka</b><p>{d.bank.bankName}</p><b>Hesap sahibi</b><p>{d.bank.accountHolder}</p>
        <b>IBAN</b>
        <p style={{wordBreak:"break-all",letterSpacing:".03em"}}>{maskedIban}</p>
        <button type="button" onClick={copyIban}>{copied?"✓ IBAN kopyalandı":"⧉ IBAN'ı kopyala"}</button>
        <small>Güvenlik için IBAN ekranda maskelidir. Kopyaladığınızda gerçek IBAN panoya alınır; banka uygulamasına yapıştırabilirsiniz.</small>
        <b>Açıklama kodu</b><p>{ref}</p>
        <small>Ödeme açıklamasına bu kodu yazın. İlk aşamada ödeme manuel doğrulanacaktır.</small>
      </div>:<div className="empty">Havale/EFT ekranı hazır. Gerçek banka adı, hesap sahibi ve IBAN Vercel ortam değişkenlerine eklendiğinde burada otomatik görünecek.</div>}
      <h2 style={{marginTop:20}}>Kartla ödeme</h2>
      <div className="empty">{d.cardReady?"Kart altyapısı yapılandırıldı; ödeme akışı bağlanacak.":"Sonraki aşamada iyzico/PayTR gibi bir sağlayıcı bağlayacağız."}</div>
    </article>
  </section>;
}
