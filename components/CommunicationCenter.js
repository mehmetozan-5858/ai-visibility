"use client";
import InboxManager from "./InboxManager";
import {useEffect,useState} from "react";
export default function CommunicationCenter(){
 const [rows,setRows]=useState([]),[msg,setMsg]=useState("");
 const [sender,setSender]=useState(null),[drafts,setDrafts]=useState({}),[sending,setSending]=useState(""),[sent,setSent]=useState([]);
 const [deliveryEvents,setDeliveryEvents]=useState({});
 async function checkDelivery(id){try{const r=await fetch("/api/communication-send",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"delivery-status",emailId:id})}),d=await r.json().catch(()=>({error:`Teslimat sorgusu geçerli yanıt vermedi (HTTP ${r.status}); teslimat doğrulanamadı.`}));if(!r.ok||d.error)throw Error(d.error);setDeliveryEvents(e=>({...e,[id]:d.event}))}catch(e){setMsg(e.message)}}
 async function send(x){setSending(x.id);setMsg("");try{const r=await fetch("/api/communication-send",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({prospectId:x.id,draft:drafts[x.id]??x.outreachDraft})}),d=await r.json();if(!r.ok)throw Error(d.error+(d.detail?` (${d.detail})`:""));setSent(s=>[...s,{name:x.name,email:x.contactEmail,id:d.delivery?.id}]);await load()}catch(e){setMsg(e.message)}finally{setSending("")}}
 async function load(){try{const r=await fetch("/api/communication-queue",{cache:"no-store"}),d=await r.json();if(!r.ok)throw new Error(d.error||"Kuyruk alınamadı");setRows(d.queue||[])}catch(e){setMsg(e.message)}}
 useEffect(()=>{load();fetch("/api/communication-send",{cache:"no-store"}).then(async r=>{if(!r.ok)throw Error("Gönderici bilgisi alınamadı");return r.json()}).then(d=>{setSender(d);setSent((d.recent||[]).map(x=>({name:x.name,email:x.recipients?.join(", "),id:x.id})))}).catch(e=>setMsg(e.message))},[]);
 return <><InboxManager/><section className="panel"><div className="section-title"><div><h2>İletişim Merkezi</h2><small>Doğrulanmış kanal + kişisel mesaj + teklif tek kontrollü kuyrukta</small></div><b>{rows.length} hazır</b></div>
 {msg&&<p className="client-message">{msg}</p>}
 <p>{sender?`Gönderici: ${sender.from||"Tanımlanmamış"}`:"Gönderici kontrol ediliyor…"}{sender&&!sender.configured?` · ${sender.reason}`:""}</p>
 {sent.map(x=><div role="status" key={x.id||x.email}><p>{x.name} · {x.email} · E-posta sağlayıcısı kabul etti · Kayıt: {x.id}. {deliveryEvents[x.id]?`Sağlayıcı olayı: ${deliveryEvents[x.id]}`:"Teslimat henüz doğrulanmadı."}</p><button onClick={()=>checkDelivery(x.id)}>Teslimatı kontrol et</button></div>)}
 {!rows.length?<div className="empty">Gönderime hazırlanmış doğrulanmış aday henüz yok.</div>:<div className="client-list">{rows.map(x=><article className="client-row" key={x.id}>
  <div className="client-avatar">✉</div><div><b>{x.name}</b><small>{x.city}, {x.country} · {x.qualificationLevel} {x.qualificationScore??"—"}/100</small><p style={{margin:"6px 0"}}>{x.outreachReason}</p><small>{x.contactEmail||x.contactUrl}</small></div>
  <div><b>{x.proposalPackage}</b><small>{x.proposalAmount} {x.proposalCurrency}</small></div>
  <details><summary>Mesaj taslağı</summary><textarea aria-label={`${x.name} mesajı`} rows={9} style={{width:"100%",minWidth:250,maxWidth:560}} value={drafts[x.id]??x.outreachDraft} onChange={e=>setDrafts(d=>({...d,[x.id]:e.target.value}))}/></details>
  <div><button disabled={!!sending||!sender?.configured||!x.contactEmail} onClick={()=>send(x)}>{sending===x.id?"Gönderiliyor…":"İlk temas e-postasını gönder"}</button><small style={{display:"block"}}>{x.contactEmail?"Henüz gönderilmedi":"E-posta bulunamadı; iletişim sayfası mevcut"}</small></div>
 </article>)}</div>}</section></>
}
