"use client";
import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
import CustomerPortal from "./CustomerPortal";
import {useLanguage} from "./LanguageProvider";

const card={background:"linear-gradient(145deg,#0b1d2a,#091722)",border:"1px solid #183f54",borderRadius:22,padding:20,boxShadow:"0 14px 35px #00000024"};
const soft={background:"#0c2230",border:"1px solid #1d4a61",borderRadius:18,padding:18};

const copy={
  tr:{
    loading:"Skorunuz hazırlanıyor…",loadFail:"Skor yüklenemedi.",title:"AI Görünürlük Skorunuz",subtitle:"Ücretsiz ilk değerlendirme",score:"Skor",waiting:"Henüz skor oluşmadı",note:"İlk aşamada yalnızca genel skorunuzu görürsünüz.",locked:"Detaylı rapor ve çözümler kilitli",lockedText:"Eksikleriniz, bulgular, ayrıntılı rapor, çözüm önerileri ve uygulama adımları ödeme tamamlandıktan sonra açılır.",unlock:"Detaylı rapor ve çözümü aç",secure:"Ödeme doğrulandıktan sonra panel otomatik olarak tam erişime açılır.",hidden1:"Eksiklerin ayrıntılı analizi",hidden2:"Önceliklendirilmiş bulgular",hidden3:"Çözüm ve uygulama planı",hidden4:"Rapor ve geçmiş taramalar",status:"Hesap durumu",limited:"Sınırlı erişim",next:"Sonraki adım"
  },
  en:{
    loading:"Preparing your score…",loadFail:"Unable to load your score.",title:"Your AI Visibility Score",subtitle:"Free initial assessment",score:"Score",waiting:"No score yet",note:"At the first stage, you only see your overall score.",locked:"Detailed report and solutions are locked",lockedText:"Your gaps, findings, detailed report, solution recommendations and implementation steps unlock after payment is completed.",unlock:"Unlock detailed report & solution",secure:"Once payment is verified, the full portal is unlocked automatically.",hidden1:"Detailed gap analysis",hidden2:"Prioritized findings",hidden3:"Solution & implementation plan",hidden4:"Reports & scan history",status:"Account status",limited:"Limited access",next:"Next step"
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

  if(error)return <section className="customer-state-card customer-state-error" style={card}><p className="client-message">{error}</p></section>;
  if(!account)return <section className="customer-state-card customer-state-loading" style={card}><p>{c.loading}</p></section>;
  if(unlocked)return <div className="customer-dashboard-live"><CustomerPortal/></div>;

  return <section className="customer-locked-grid">
    <article className="customer-score-card" style={card}>
      <div className="customer-score-meta"><span>{c.subtitle}</span><span className="customer-status-pill">{c.limited}</span></div>
      <h2>{c.title}</h2>
      <p>{c.note}</p>
      <div className="customer-score-orb-wrap" style={{...soft,textAlign:"center",padding:"28px 18px"}}>
        <div>{c.score}</div>
        <strong>{latest?.score==null?"—":`${latest.score}/100`}</strong>
        <small>{latest?.score==null?c.waiting:"AI Visibility"}</small>
      </div>
    </article>

    <article className="customer-unlock-card" style={{...card,borderColor:"#3f5266"}}>
      <div className="customer-unlock-heading">
        <div className="customer-lock-icon">🔒</div>
        <div><span className="customer-unlock-kicker">{c.next}</span><h3>{c.locked}</h3><p>{c.lockedText}</p></div>
      </div>
      <div className="customer-locked-features">
        {[c.hidden1,c.hidden2,c.hidden3,c.hidden4].map(x=><div key={x} style={{...soft,padding:"11px 13px"}}><span>✓</span>{x}</div>)}
      </div>
      <Link className="customer-unlock-cta" href="/hizmetler">{c.unlock}<span>↗</span></Link>
      <p className="customer-secure-note">{c.secure}</p>
    </article>
  </section>;
}
