"use client";
import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
import CustomerPortal from "./CustomerPortal";
import {useLanguage} from "./LanguageProvider";

const card={background:"linear-gradient(145deg,#0b1d2a,#091722)",border:"1px solid #183f54",borderRadius:22,padding:20,boxShadow:"0 14px 35px #00000024"};
const soft={background:"#0c2230",border:"1px solid #1d4a61",borderRadius:18,padding:18};

const copy={
  tr:{
    loading:"Skorunuz hazırlanıyor…",loadFail:"Skor yüklenemedi.",title:"AI Görünürlük Skorunuz",subtitle:"Ücretsiz ilk değerlendirme",score:"Skor",waiting:"Henüz skor oluşmadı",note:"İlk aşamada yalnızca genel skorunuzu görürsünüz.",locked:"Detaylı rapor ve çözümler kilitli",lockedText:"Eksikleriniz, bulgular, ayrıntılı rapor, çözüm önerileri ve uygulama adımları ödeme tamamlandıktan sonra açılır.",unlock:"Detaylı rapor ve çözümü aç",secure:"Ödeme doğrulandıktan sonra panel otomatik olarak tam erişime açılır.",hidden1:"Eksiklerin ayrıntılı analizi",hidden2:"Önceliklendirilmiş bulgular",hidden3:"Çözüm ve uygulama planı",hidden4:"Rapor ve geçmiş taramalar"
  },
  en:{
    loading:"Preparing your score…",loadFail:"Unable to load your score.",title:"Your AI Visibility Score",subtitle:"Free initial assessment",score:"Score",waiting:"No score yet",note:"At the first stage, you only see your overall score.",locked:"Detailed report and solutions are locked",lockedText:"Your gaps, findings, detailed report, solution recommendations and implementation steps unlock after payment is completed.",unlock:"Unlock detailed report & solution",secure:"Once payment is verified, the full portal is unlocked automatically.",hidden1:"Detailed gap analysis",hidden2:"Prioritized findings",hidden3:"Solution & implementation plan",hidden4:"Reports & scan history"
  }
};

export default function CustomerPortalGate(){
  const {lang}=useLanguage();
  const c=copy[lang]||copy.tr;
  const [account,setAccount]=useState(null);
  const [error,setError]=useState("");

  useEffect(()=>{
    let alive=true;
    fetch("/api/client-portal",{cache:"no-store",headers:{"accept-language":lang}})
      .then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||c.loadFail);return d})
      .then(d=>{if(alive)setAccount(d.account)})
      .catch(e=>{if(alive)setError(e.message||c.loadFail)});
    return()=>{alive=false};
  },[lang]);

  const latest=useMemo(()=>{
    const scans=(account?.scans||[]).filter(x=>x.status==="completed"&&Number.isFinite(Number(x.score)));
    scans.sort((a,b)=>new Date(b.completedAt||b.createdAt||0)-new Date(a.completedAt||a.createdAt||0));
    return scans[0]||null;
  },[account]);

  const unlocked=useMemo(()=>{
    return (account?.payments||[]).some(p=>String(p.status||"").toLowerCase()==="paid");
  },[account]);

  if(error)return <section style={card}><p className="client-message">{error}</p></section>;
  if(!account)return <section style={card}><p>{c.loading}</p></section>;
  if(unlocked)return <CustomerPortal/>;

  return <section style={{display:"grid",gap:14}}>
    <article style={card}>
      <div style={{fontSize:12,opacity:.7,textTransform:"uppercase",letterSpacing:".12em"}}>{c.subtitle}</div>
      <h2 style={{margin:"7px 0 4px",fontSize:26}}>{c.title}</h2>
      <p style={{margin:"0 0 18px",opacity:.72}}>{c.note}</p>
      <div style={{...soft,textAlign:"center",padding:"28px 18px"}}>
        <div style={{fontSize:13,opacity:.7}}>{c.score}</div>
        <strong style={{display:"block",fontSize:54,lineHeight:1.05,margin:"8px 0"}}>{latest?.score==null?"—":`${latest.score}/100`}</strong>
        <small style={{opacity:.7}}>{latest?.score==null?c.waiting:"AI Visibility"}</small>
      </div>
    </article>

    <article style={{...card,borderColor:"#3f5266"}}>
      <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
        <div style={{fontSize:28}}>🔒</div>
        <div><h3 style={{margin:"0 0 7px"}}>{c.locked}</h3><p style={{margin:0,opacity:.76}}>{c.lockedText}</p></div>
      </div>
      <div style={{display:"grid",gap:8,margin:"16px 0"}}>
        {[c.hidden1,c.hidden2,c.hidden3,c.hidden4].map(x=><div key={x} style={{...soft,padding:"11px 13px",opacity:.66}}>🔒 {x}</div>)}
      </div>
      <Link href="/hizmetler" style={{display:"block",textAlign:"center",padding:"13px 16px",borderRadius:13,textDecoration:"none",fontWeight:800,background:"linear-gradient(90deg,#367cff,#22cfa4)",color:"white"}}>{c.unlock}</Link>
      <p style={{fontSize:12,opacity:.65,textAlign:"center",margin:"10px 0 0"}}>{c.secure}</p>
    </article>
  </section>;
}
