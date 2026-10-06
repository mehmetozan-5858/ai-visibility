"use client";
import {useEffect,useState} from 'react';
const labels={queued:'İşlem bekliyor',analyzed:'Analiz edildi','review-required':'İnsan incelemesi gerekiyor'};
export default function InboxManager(){
 const [messages,setMessages]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function load(){try{const r=await fetch('/api/inbox',{cache:'no-store'}),d=await r.json();if(!r.ok)throw new Error(d.error);setMessages(d.messages||[])}catch(e){setError(e.message)}}
 useEffect(()=>{load()},[]);
 async function process(){setBusy(true);setError('');try{const r=await fetch('/api/inbox',{method:'POST'}),d=await r.json();if(!r.ok)throw new Error(d.error);if(d.skipped)setError(d.skipped==='inbox-not-configured'?'Gelen e-posta bağlantısını Ayarlar üzerinden tamamlayın.':'Başka işlem sürüyor.');await load()}catch(e){setError(e.message)}finally{setBusy(false)}}
 return <section className="panel"><div className="section-title"><div><h2>Gelen Yanıtlar</h2><small>Doğrulanmış göndericiler CRM kaydıyla eşleştirilir; yanıt taslakları inceleme bekler.</small></div><button onClick={process} disabled={busy}>{busy?'İşleniyor…':'Gelenleri işle'}</button></div>{error&&<p role="status">{error}</p>}{!messages.length?<p>Henüz alınan yanıt yok. Bağlantı durumu Ayarlar sayfasında.</p>:messages.map(x=><article key={x.eventId}><b>{x.sender||'Gönderici kontrol ediliyor'} · {x.subject}</b><p>{labels[x.status]||x.status}</p><details><summary>Yanıt metni</summary><p style={{whiteSpace:'pre-wrap'}}>{x.body}</p></details>{x.status==='review-required'&&<small>Kaydı ve gönderici doğrulamasını kontrol edin.</small>}</article>)}</section>;
}
