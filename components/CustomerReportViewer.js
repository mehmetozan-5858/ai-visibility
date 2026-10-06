"use client";
import {useLanguage} from "./LanguageProvider";
export default function CustomerReportViewer(){
 const {lang}=useLanguage(),en=lang==="en";
 return <main className="customer-report-viewer" style={{maxWidth:"none",padding:0,height:"100dvh",display:"flex",flexDirection:"column"}}>
  <header className="report-viewer-toolbar" style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"12px 16px",background:"#06121b",flexShrink:0}}>
   <strong>{en?"Visibility report":"Görünürlük raporu"}</strong>
   <div style={{display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
    <a className="mini-action" href="/api/client-portal/report?download=1">{en?"Download PDF":"PDF indir"}</a>
    <a href="/musteri-panel" aria-label={en?"Close report and return to portal":"Raporu kapat ve müşteri paneline dön"} style={{display:"grid",placeItems:"center",width:44,height:44,borderRadius:12,background:"#153346",fontSize:28}}>×</a>
   </div>
  </header>
  <iframe title={en?"PDF visibility report":"PDF görünürlük raporu"} src="/api/client-portal/report" style={{width:"100%",flex:1,minHeight:0,border:0,background:"white"}}/>
 </main>;
}
