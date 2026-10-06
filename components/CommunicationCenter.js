"use client";
import InboxManager from "./InboxManager";
import {useEffect,useState} from "react";
export default function CommunicationCenter(){
 const [rows,setRows]=useState([]),[msg,setMsg]=useState("");
 async function load(){try{const r=await fetch("/api/communication-queue",{cache:"no-store"}),d=await r.json();if(!r.ok)throw new Error(d.error||"Kuyruk alınamadı");setRows(d.queue||[])}catch(e){setMsg(e.message)}}
 useEffect(()=>{load()},[]);
 return <><InboxManager/><section className="panel"><div className="section-title"><div><h2>İletişim Merkezi</h2><small>Doğrulanmış kanal + kişisel mesaj + teklif tek kontrollü kuyrukta</small></div><b>{rows.length} hazır</b></div>
 {msg&&<p className="client-message">{msg}</p>}
 {!rows.length?<div className="empty">Gönderime hazırlanmış doğrulanmış aday henüz yok.</div>:<div className="client-list">{rows.map(x=><article className="client-row" key={x.id}>
  <div className="client-avatar">✉</div><div><b>{x.name}</b><small>{x.city}, {x.country} · {x.qualificationLevel} {x.qualificationScore??"—"}/100</small><p style={{margin:"6px 0"}}>{x.outreachReason}</p><small>{x.contactEmail||x.contactUrl}</small></div>
  <div><b>{x.proposalPackage}</b><small>{x.proposalAmount} {x.proposalCurrency}</small></div>
  <details><summary>Mesaj taslağı</summary><p style={{maxWidth:560,whiteSpace:"pre-wrap"}}>{x.outreachDraft}</p></details>
  <span>Kontrollü kuyruk<small style={{display:"block"}}>Henüz gönderilmedi</small></span>
 </article>)}</div>}</section></>
}
