"use client";
import {useState} from "react";
import SalesCommandCenter from "./SalesCommandCenter";
import AgentsManager from "./AgentsManager";
import LeadsManager from "./LeadsManager";
import CRMManager from "./CRMManager";
import WorkManager from "./WorkManager";
import PaymentsManager from "./PaymentsManager";
import SalesManager from "./SalesManager";
import CreatorAgentDesks from "./CreatorAgentDesks";
import BusinessAgentDesks from "./BusinessAgentDesks";
import AgentCenter from "./AgentCenter";
import CommunicationCenter from "./CommunicationCenter";

const businessTabs=[
  ["overview","Satış Komuta Merkezi"],
  ["center","Ajan Merkezi"],
  ["diagnosis","Sorun Tespit Masaları"],
  ["solutions","Çözüm Masaları"],
  ["crm","Lead / CRM"],
  ["communication","İletişim Merkezi"],
  ["work","İş / Onay"]
];
const socialTabs=[
  ["center","Ajan Merkezi"],
  ["diagnosis","Sorun Tespit Masaları"],
  ["solutions","Çözüm Masaları"]
];

function Tabs({tabs,value,onChange,label}){
  return <section className="panel" style={{marginBottom:18,padding:12}}>
    <div role="tablist" aria-label={label} style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8}}>
      {tabs.map(([id,text])=><button key={id} type="button" role="tab" aria-selected={value===id} onClick={()=>onChange(id)} className={value===id?"active":""} style={{minHeight:44,padding:"9px 10px",fontSize:14,width:"100%"}}>{text}{value===id?<small style={{display:"block",marginTop:2}}>Açık</small>:null}</button>)}
    </div>
  </section>;
}

export default function AgentsWorkspace(){
  const [area,setArea]=useState("business");
  const [businessTab,setBusinessTab]=useState("overview");
  const [socialTab,setSocialTab]=useState("diagnosis");
  return <>
    <section className="panel" style={{marginBottom:18,padding:12}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10}}>
        <button type="button" className={area==="business"?"active":""} onClick={()=>setArea("business")} style={{minHeight:52,fontWeight:800}}>İşletme AI Visibility</button>
        <button type="button" className={area==="social"?"active":""} onClick={()=>setArea("social")} style={{minHeight:52,fontWeight:800}}>Sosyal Medya / Creator</button>
      </div>
      <p style={{margin:"10px 2px 0",fontSize:13,opacity:.7}}>{area==="business"?"İşletme müşterileri, görünürlük, satış ve çözüm operasyonları.":"YouTube, Instagram, TikTok, X ve diğer sosyal platformlar için ayrı ajan organizasyonu."}</p>
    </section>

    {area==="business"&&<>
      <Tabs tabs={businessTabs} value={businessTab} onChange={setBusinessTab} label="İşletme ajan masaları"/>
      {businessTab==="overview"&&<><SalesCommandCenter/><AgentsManager/><SalesManager/><PaymentsManager/></>}
      {businessTab==="center"&&<AgentCenter/>}
      {businessTab==="diagnosis"&&<BusinessAgentDesks mode="diagnosis"/>}
      {businessTab==="solutions"&&<BusinessAgentDesks mode="solution"/>}
      {businessTab==="crm"&&<><LeadsManager/><CRMManager/></>}
      {businessTab==="communication"&&<CommunicationCenter/>}
      {businessTab==="work"&&<WorkManager/>}
    </>}

    {area==="social"&&<>
      <Tabs tabs={socialTabs} value={socialTab} onChange={setSocialTab} label="Sosyal medya ajan masaları"/>
      {socialTab==="center"&&<AgentCenter/>}
      {socialTab==="diagnosis"&&<CreatorAgentDesks mode="diagnosis"/>}
      {socialTab==="solutions"&&<CreatorAgentDesks mode="solution"/>}
    </>}
  </>;
}
