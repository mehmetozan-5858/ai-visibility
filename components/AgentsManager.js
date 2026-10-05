"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
const A=[
 ["Araştırma Ajanı","Ülke, şehir ve sektöre göre gerçek lead araştırması","/lead-finder"],
 ["Görünürlük Ajanı","GEO/AEO taramalarını yönetir","/taramalar"],
 ["İçerik Ajanı","Tarama sonuçlarından iyileştirme önerileri üretir","/raporlar"],
 ["Uygulama Ajanı","Eksikleri hazır içerik, schema ve görev paketine dönüştürür","/raporlar"],
 ["Satış Ajanı","Düşük skorlu müşterilerden teklif fırsatı üretir","/ajanlar"],
 ["CEO Ajanı","Yönetici özetlerini raporlar","/raporlar"]
];
export default function AgentsManager(){
 const [status,setStatus]=useState(null);
 useEffect(()=>{fetch("/api/status",{cache:"no-store"}).then(r=>r.json()).then(setStatus)},[]);
 const connected=status?.providers?.filter(x=>x.status==="connected").length||0;
 return <section className="agent-list">{A.map(([n,d,h],i)=><article className="panel agent-row" key={n}><div><h2>{n}</h2><p>{d}</p></div><div className="agent-actions"><span className={i===1&&connected===0?"waiting":"ready"}>{i===1&&connected===0?"○ Sağlayıcı bekliyor":"● Hazır"}</span><Link className="mini-action" href={h}>Aç →</Link></div></article>)}</section>;
}
