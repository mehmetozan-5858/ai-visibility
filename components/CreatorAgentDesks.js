"use client";
import {useMemo,useState} from "react";
import {creatorAgentDesks,creatorPlatforms,creatorWorkflow} from "../lib/creator-agents";
import CreatorOperations from "./CreatorOperations";

export default function CreatorAgentDesks({mode="diagnosis"}){
  const [platform,setPlatform]=useState("youtube");
  const selected=useMemo(()=>creatorPlatforms.find(x=>x.id===platform)||creatorPlatforms[0],[platform]);
  const solutionMode=mode==="solution";
  const desks=creatorAgentDesks.filter(x=>solutionMode?["solution","execution"].includes(x.id):["intelligence","diagnosis"].includes(x.id));
  return <div style={{display:"grid",gap:16}}>
    <section className="panel">
      <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start",flexWrap:"wrap"}}>
        <div>
          <h2 style={{margin:"0 0 6px"}}>{solutionMode?"Sosyal Medya Çözüm Masaları":"Sosyal Medya Sorun Tespit Masaları"}</h2>
          <p style={{margin:0,opacity:.75,maxWidth:760}}>{solutionMode?"Rapor sonrası bulunan sorunları içerik, keşif, profil, büyüme ve gelir görevlerine dönüştüren ayrı sosyal medya çözüm alanı.":"YouTube, Instagram, TikTok, X ve diğer creator platformlarında sorunları bulup önceliklendiren ayrı sosyal medya analiz alanı."}</p>
        </div>
        <span style={{padding:"7px 10px",borderRadius:999,background:"rgba(37,99,235,.10)",fontSize:13,fontWeight:700}}>Sosyal medya ayağı</span>
      </div>
    </section>

    <section className="panel">
      <h3 style={{marginTop:0}}>Platform Masası</h3>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8}}>
        {creatorPlatforms.map(p=><button key={p.id} type="button" onClick={()=>setPlatform(p.id)} className={platform===p.id?"active":""} style={{minHeight:44}}>{p.name}</button>)}
      </div>
      <div style={{marginTop:14,padding:14,border:"1px solid rgba(148,163,184,.25)",borderRadius:14}}>
        <strong>{selected.name} uzman ajanları şu alanlara odaklanır:</strong>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10}}>{selected.focus.map(x=><span key={x} style={{padding:"6px 9px",borderRadius:999,background:"rgba(148,163,184,.12)",fontSize:13}}>{x}</span>)}</div>
      </div>
    </section>

    <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:12}}>
      {desks.map(d=><article className="panel" key={d.id} style={{height:"100%"}}>
        <div style={{fontSize:12,fontWeight:700,opacity:.6,textTransform:"uppercase",letterSpacing:.5}}>{d.phase}</div>
        <h3 style={{margin:"5px 0 12px"}}>{d.title}</h3>
        <div style={{display:"grid",gap:9}}>{d.agents.map(a=><div key={a.name} style={{padding:11,border:"1px solid rgba(148,163,184,.22)",borderRadius:12}}><strong style={{display:"block",marginBottom:3}}>{a.name}</strong><span style={{fontSize:13,opacity:.75}}>{a.job}</span></div>)}</div>
      </article>)}
    </section>

    {!solutionMode&&<section className="panel">
      <h3 style={{marginTop:0}}>Sosyal medya iş akışı</h3>
      <div style={{display:"grid",gap:8}}>{creatorWorkflow.map((x,i)=><div key={x} style={{display:"flex",gap:10,alignItems:"center"}}><span style={{width:26,height:26,borderRadius:999,display:"inline-grid",placeItems:"center",background:"rgba(37,99,235,.10)",fontWeight:800}}>{i+1}</span><span>{x}</span></div>)}</div>
    </section>}

    {solutionMode&&<CreatorOperations/>}
  </div>;
}
