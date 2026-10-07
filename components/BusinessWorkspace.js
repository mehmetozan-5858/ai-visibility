"use client";
import {useState} from "react";
import ClientAccountManager from "./ClientAccountManager";
import CommerceImpactManager from "./CommerceImpactManager";

const tabs=[["account","İşletme Geçmişi"],["commerce","Commerce Ready + Business Impact"]];

export default function BusinessWorkspace(){
  const [tab,setTab]=useState("account");
  return <section className="business-workspace">
    <div className="business-tabs" role="tablist" aria-label="İşletme çalışma alanı" style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8,marginBottom:14}}>
      {tabs.map(([id,label])=>{
        const active=tab===id;
        return <button
          key={id}
          type="button"
          role="tab"
          aria-selected={active}
          onClick={()=>setTab(id)}
          style={{
            whiteSpace:"normal",
            opacity:active?1:.72,
            cursor:"pointer",
            boxShadow:active?"0 0 0 2px #4aa7ff66":"none",
            transform:active?"translateY(-1px)":"none",
            transition:"opacity .16s ease, box-shadow .16s ease, transform .16s ease"
          }}
        >{label}{active&&<small style={{display:"block",marginTop:4,fontSize:11}}>Açık</small>}</button>
      })}
    </div>
    <div role="tabpanel">
      {tab==="account"?<ClientAccountManager/>:<CommerceImpactManager/>}
    </div>
  </section>;
}
