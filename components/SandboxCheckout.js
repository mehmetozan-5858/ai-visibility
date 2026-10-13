'use client';
import {useState} from 'react';
import Script from 'next/script';
export default function SandboxCheckout({token,catalogs}){
 const [currency,setCurrency]=useState('TRY'),[ready,setReady]=useState(false),[message,setMessage]=useState('');
 function initialize(){try{window.Paddle.Environment.set('sandbox');window.Paddle.Initialize({token,eventCallback:event=>{if(event.name==='checkout.completed')setMessage('Test checkout tamamlandı. Abonelik durumu imzalı webhook ile ayrı test deposunda doğrulanmalıdır.');}});setReady(true)}catch{setMessage('Sandbox checkout başlatılamadı.')}}
 function open(plan){if(!ready||!token.startsWith('test_'))return;try{window.Paddle.Checkout.open({items:[{priceId:plan.priceId,quantity:1}],settings:{allowLogout:true,allowDiscountRemoval:false},customData:{test_only:true,service_code:plan.code}})}catch{setMessage('Test ödeme penceresi açılamadı.')}}
 return <>{token&&<Script src="https://cdn.paddle.com/paddle/v2/paddle.js" onLoad={initialize} onError={()=>setMessage('Paddle.js yüklenemedi.')}/>}<label>Para birimi <select value={currency} onChange={e=>setCurrency(e.target.value)}>{Object.keys(catalogs).map(c=><option key={c}>{c}</option>)}</select></label>{!token&&<p>Sandbox istemci tokeni bekleniyor. Ödeme düğmeleri kapalı.</p>}<p role="status">{message}</p><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:16}}>{catalogs[currency].map(plan=><section className="panel" key={plan.code}><h2>{plan.name}</h2><p>{new Intl.NumberFormat('tr-TR',{style:'currency',currency}).format(plan.amount)}{plan.kind==='monthly'?' / ay':' · tek seferlik'}</p><button disabled={!ready} onClick={()=>open(plan)}>Test ödeme ekranını aç</button></section>)}</div></>;
}
