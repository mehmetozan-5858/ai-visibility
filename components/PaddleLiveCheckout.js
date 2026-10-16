"use client";
import {useEffect,useState} from "react";
import {useLanguage} from "./LanguageProvider";
import {trackAnalyticsEvent} from "../lib/analytics-client";

const CLIENT_TOKEN=process.env.NEXT_PUBLIC_PADDLE_LIVE_CLIENT_TOKEN||"";
const copy={
  tr:{title:"Kartla güvenli ödeme",help:"Kart bilgileriniz AI Visibility sunucularına gelmez. Ödeme, Paddle’ın güvenli ödeme ekranında tamamlanır.",consent:"Mesafeli Hizmet Sözleşmesi ile İptal / İade Politikasını okudum ve hizmetin ödeme sonrası başlamasını onaylıyorum.",agreement:"Hizmet Sözleşmesi",refund:"İptal / İade",opening:"Güvenli ödeme hazırlanıyor…",button:"Paddle ile güvenli ödemeye geç",prepareError:"Paddle ödeme oturumu hazırlanamadı.",openError:"Paddle ödeme oturumu açılamadı."},
  en:{title:"Secure card payment",help:"Your card details never reach AI Visibility servers. Payment is completed in Paddle’s secure checkout.",consent:"I have read the Service Agreement and Cancellation / Refund Policy and agree that the service may start after payment.",agreement:"Service Agreement",refund:"Cancellation / Refund",opening:"Preparing secure checkout…",button:"Continue securely with Paddle",prepareError:"Paddle checkout could not be prepared.",openError:"Paddle checkout could not be opened."}
};
let paddlePromise;
function loadPaddle(){
  if(typeof window==="undefined")return Promise.reject(new Error("browser-required"));
  if(window.Paddle)return Promise.resolve(window.Paddle);
  if(paddlePromise)return paddlePromise;
  paddlePromise=new Promise((resolve,reject)=>{
    const existing=document.querySelector('script[data-ai-paddle-live="1"]');
    if(existing){existing.addEventListener('load',()=>resolve(window.Paddle),{once:true});existing.addEventListener('error',()=>reject(new Error('paddle-load-failed')),{once:true});return;}
    const script=document.createElement('script');
    script.src='https://cdn.paddle.com/paddle/v2/paddle.js';script.async=true;script.dataset.aiPaddleLive='1';
    script.onload=()=>window.Paddle?resolve(window.Paddle):reject(new Error('paddle-unavailable'));
    script.onerror=()=>reject(new Error('paddle-load-failed'));
    document.head.appendChild(script);
  });
  return paddlePromise;
}

export default function PaddleLiveCheckout({token}){
  const {lang}=useLanguage();const c=copy[lang]||copy.tr;
  const [eligible,setEligible]=useState(false),[checked,setChecked]=useState(false),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{
    let active=true;
    if(!CLIENT_TOKEN||!token){setChecked(true);return()=>{active=false};}
    fetch('/api/payment?token='+encodeURIComponent(token),{cache:'no-store',headers:{'accept-language':lang}})
      .then(async r=>{const data=await r.json();return r.ok&&data?.paddleReady===true&&data?.payment?.status!=="paid"&&!data?.pilot;})
      .then(ok=>{if(active)setEligible(Boolean(ok));})
      .catch(()=>{if(active)setEligible(false);})
      .finally(()=>{if(active)setChecked(true);});
    return()=>{active=false};
  },[token,lang]);
  if(!CLIENT_TOKEN||!token||!checked||!eligible)return null;
  async function start(){
    if(!consent)return;
    setBusy(true);setError('');
    try{
      const Paddle=await loadPaddle();
      if(!Paddle.Initialized)Paddle.Initialize({token:CLIENT_TOKEN});
      const response=await fetch('/api/payment/paddle',{method:'POST',headers:{'content-type':'application/json','accept-language':lang},body:JSON.stringify({token,consent:true})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||c.prepareError);
      trackAnalyticsEvent('begin_checkout',{payment_provider:'paddle',language:lang});
      Paddle.Checkout.open({transactionId:data.transactionId,settings:{displayMode:'overlay',theme:'light'}});
    }catch(e){setError(e?.message||c.openError);}
    finally{setBusy(false);}
  }
  return <section className="panel" lang={lang} data-localized style={{marginBottom:16}}>
    <div style={{fontSize:11,letterSpacing:'.16em',fontWeight:900,color:'#54dfd0',textTransform:'uppercase',marginBottom:8}}>Paddle Live</div>
    <h2 style={{marginTop:0}}>{c.title}</h2>
    <p>{c.help}</p>
    <label style={{display:'flex',gap:10,alignItems:'flex-start',margin:'14px 0'}}>
      <input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} style={{width:18,height:18,marginTop:2}}/>
      <span>{c.consent}</span>
    </label>
    <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:12}}><a href="/mesafeli-hizmet-sozlesmesi" target="_blank">{c.agreement}</a><a href="/iptal-iade" target="_blank">{c.refund}</a></div>
    <button type="button" onClick={start} disabled={!consent||busy}>{busy?c.opening:c.button}</button>
    {error&&<p className="client-message" role="alert" style={{marginTop:12}}>{error}</p>}
  </section>;
}
