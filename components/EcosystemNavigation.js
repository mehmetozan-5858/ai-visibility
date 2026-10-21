"use client";
import ecosystem from "../lib/ecosystem-contract.cjs";
import {useLanguage} from "./LanguageProvider";

export default function EcosystemNavigation({admin=false}){
  const {lang}=useLanguage();
  const en=lang==="en";
  return <nav aria-label={en?"Ecosystem navigation":"Ekosistem geçişleri"} style={{display:"flex",flexWrap:"wrap",gap:10,padding:"12px 0",alignItems:"center"}}>
    <a className="mini-action" href={admin?ecosystem.links.visibilityAdmin:ecosystem.links.visibilityPortal} rel="noreferrer">AI Visibility</a>
    <a className="mini-action" href={admin?ecosystem.links.brokerAdmin:ecosystem.links.brokerPortal} rel="noreferrer">Global Broker →</a>
    <a className="mini-action" href={ecosystem.links.transfer} rel="noreferrer">{en?"Business transfer":"Firma aktarımı"}</a>
  </nav>;
}
