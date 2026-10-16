"use client";
import {useState} from "react";

const CLIENT_TOKEN=process.env.NEXT_PUBLIC_PADDLE_LIVE_CLIENT_TOKEN||"";
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
  const [consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  if(!CLIENT_TOKEN||!token)return null;
  async function start(){
    if(!consent)return;
    setBusy(true);setError('');
    try{
      const Paddle=await loadPaddle();
      if(!Paddle.Initialized)Paddle.Initialize({token:CLIENT_TOKEN});
      const response=await fetch('/api/payment/paddle',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token,consent:true})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||'Paddle ödeme oturumu hazırlanamadı.');
      Paddle.Checkout.open({transactionId:data.transactionId,settings:{displayMode:'overlay',theme:'light'}});
    }catch(e){setError(e?.message||'Paddle ödeme oturumu açılamadı.');}
    finally{setBusy(false);}
  }
  return <section className="panel" style={{marginBottom:16}}>
    <div style={{fontSize:11,letterSpacing:'.16em',fontWeight:900,color:'#54dfd0',textTransform:'uppercase',marginBottom:8}}>Paddle Live</div>
    <h2 style={{marginTop:0}}>Kartla güvenli ödeme</h2>
    <p>Kart bilgileriniz AI Visibility sunucularına gelmez. Ödeme, Paddle’ın güvenli ödeme ekranında tamamlanır.</p>
    <label style={{display:'flex',gap:10,alignItems:'flex-start',margin:'14px 0'}}>
      <input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} style={{width:18,height:18,marginTop:2}}/>
      <span>Mesafeli Hizmet Sözleşmesi ile İptal / İade Politikasını okudum ve hizmetin ödeme sonrası başlamasını onaylıyorum.</span>
    </label>
    <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:12}}><a href="/mesafeli-hizmet-sozlesmesi" target="_blank">Hizmet Sözleşmesi</a><a href="/iptal-iade" target="_blank">İptal / İade</a></div>
    <button type="button" onClick={start} disabled={!consent||busy}>{busy?'Güvenli ödeme hazırlanıyor…':'Paddle ile güvenli ödemeye geç'}</button>
    {error&&<p className="client-message" role="alert" style={{marginTop:12}}>{error}</p>}
  </section>;
}
