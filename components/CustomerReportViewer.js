"use client";
import {useState} from "react";
import {useLanguage} from "./LanguageProvider";
export default function CustomerReportViewer(){
 const {lang}=useLanguage(),en=lang==="en";
 const [sending,setSending]=useState(false),[notice,setNotice]=useState('');
 async function emailReport(){
  setSending(true);setNotice('');
  try{const r=await fetch('/api/client-portal/report/email',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({confirmSendReport:true})});
   const data=await r.json();if(!r.ok)throw Error(data.error||'Rapor gönderilemedi.');
   setNotice(en?'Accepted by the email provider; inbox delivery has not been confirmed.':data.message);
  }catch(e){setNotice(e.message)}finally{setSending(false)}
 }
 return <main className="customer-report-viewer" style={{maxWidth:"none",padding:0,height:"100dvh",display:"flex",flexDirection:"column"}}>
  <header className="report-viewer-toolbar" style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"12px 16px",background:"#06121b",flexShrink:0}}>
   <strong>{en?"Visibility report":"Görünürlük raporu"}</strong>
   <div style={{display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
    <button className="mini-action" disabled={sending} onClick={emailReport}>{sending?(en?"Sending…":"Gönderiliyor…"):(en?"Email my report":"Raporumu e-postala")}</button>
    <a className="mini-action" href="/api/client-portal/report?download=1">{en?"Download PDF":"PDF indir"}</a>
    <a href="/musteri-panel" aria-label={en?"Close report and return to portal":"Raporu kapat ve müşteri paneline dön"} style={{display:"grid",placeItems:"center",width:44,height:44,borderRadius:12,background:"#153346",fontSize:28}}>×</a>
   </div>
  </header>
  {notice&&<p role="status" style={{margin:0,padding:"8px 16px",background:"#102c3c"}}>{notice}</p>}
  <iframe title={en?"PDF visibility report":"PDF görünürlük raporu"} src="/api/client-portal/report" style={{width:"100%",flex:1,minHeight:0,border:0,background:"white"}}/>
 </main>;
}
