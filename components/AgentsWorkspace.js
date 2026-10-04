"use client";
import {useState} from "react";
import SalesCommandCenter from "./SalesCommandCenter";
import AgentsManager from "./AgentsManager";
import LeadsManager from "./LeadsManager";
import CRMManager from "./CRMManager";
import WorkManager from "./WorkManager";
import PaymentsManager from "./PaymentsManager";
import SalesManager from "./SalesManager";

const tabs=[
  ["command","Sales Command Center"],
  ["leads","Leadler"],
  ["crm","CRM"],
  ["work","İş / Onay"],
  ["sales","Satış Ajanı"]
];

export default function AgentsWorkspace(){
  const [tab,setTab]=useState("command");
  return <>
    <section className="panel" style={{marginBottom:18,padding:12}}>
      <div role="tablist" aria-label="Ajanlar çalışma alanı" style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8}}>
        {tabs.map(([id,label],index)=><button
          key={id}
          type="button"
          role="tab"
          aria-selected={tab===id}
          onClick={()=>setTab(id)}
          className={tab===id?"active":""}
          style={{minHeight:44,padding:"9px 10px",fontSize:14,width:"100%",gridColumn:index===4?"1 / -1":undefined}}
        >{label}{tab===id?<small style={{display:"block",marginTop:2}}>Açık</small>:null}</button>)}
      </div>
    </section>

    {tab==="command"&&<><SalesCommandCenter/><AgentsManager/></>}
    {tab==="leads"&&<LeadsManager/>}
    {tab==="crm"&&<CRMManager/>}
    {tab==="work"&&<WorkManager/>}
    {tab==="sales"&&<><SalesManager/><PaymentsManager/></>}
  </>;
}
