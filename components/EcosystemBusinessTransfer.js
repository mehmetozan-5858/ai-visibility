"use client";
import ecosystem from "../lib/ecosystem-contract.cjs";
import {useLanguage} from "./LanguageProvider";

export default function EcosystemBusinessTransfer({account}){
  const {lang}=useLanguage();
  const en=lang==="en",fields=ecosystem.fromAccount(account);
  if(!fields.businessName)return null;
  return <section aria-label={en?"Business profile transfer":"Firma profili aktarımı"} style={{padding:16,margin:"12px 0",border:"1px solid #246c72",borderRadius:14,overflowWrap:"anywhere"}}>
    <h3>{en?"Continue with this business in Broker":"Bu işletmeyle Broker’da devam edin"}</h3>
    <p>{[fields.businessName,fields.website,fields.country,fields.sector].filter(Boolean).join(" · ")}</p>
    <a className="mini-action" rel="noreferrer" href={ecosystem.build(fields,"broker")}>{en?"Review these details in Global Broker →":"Bilgileri Global Broker’da incele →"}</a>
    <p style={{fontSize:12}}>{en?"Only the business name, website, country and supported industry are transferred. Review them in Broker before applying. Your account and payment details stay here.":"Yalnız firma adı, site, ülke ve desteklenen sektör taşınır. Broker’da inceleyip forma uygulayabilirsiniz. Hesap ve ödeme bilgileriniz burada kalır."}</p>
  </section>;
}
