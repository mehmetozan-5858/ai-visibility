"use client";
import {useState} from "react";
import ClientAccountManager from "./ClientAccountManager";
import CommerceImpactManager from "./CommerceImpactManager";

const tabs=[["account","İşletme Geçmişi"],["commerce","Commerce Ready + Business Impact"]];

export default function BusinessWorkspace(){
  const [tab,setTab]=useState("commerce");
  return <section>
    <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8,marginBottom:14}}>
      {tabs.map(([id,label])=><button key={id} type="button" onClick={()=>setTab(id)} aria-pressed={tab===id} style={{whiteSpace:"normal",opacity:tab===id?1:.62,boxShadow:tab===id?"0 0 0 2px #4aa7ff55":"none"}}>{label}</button>)}
    </div>
    {tab==="account"?<ClientAccountManager/>:<CommerceImpactManager/>}
  </section>;
}
