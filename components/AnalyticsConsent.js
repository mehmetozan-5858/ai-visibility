"use client";
import {useEffect,useState} from "react";
import {usePathname} from "next/navigation";

const STORAGE_KEY="aiv_analytics_consent";
const measurementId=process.env.NEXT_PUBLIC_GA4_ID||"";

function ensureDataLayer(){
  window.dataLayer=window.dataLayer||[];
  window.gtag=window.gtag||function(){window.dataLayer.push(arguments)};
}

function applyConsent(value){
  ensureDataLayer();
  const granted=value==="granted";
  window.__aivAnalyticsAllowed=granted;
  window.gtag("consent","update",{analytics_storage:granted?"granted":"denied"});
}

function loadGa4(){
  if(!measurementId||document.querySelector('script[data-aiv-ga4="true"]'))return;
  ensureDataLayer();
  window.gtag("js",new Date());
  window.gtag("config",measurementId,{anonymize_ip:true,send_page_view:false});
  const script=document.createElement("script");
  script.async=true;
  script.src=`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  script.dataset.aivGa4="true";
  document.head.appendChild(script);
}

export default function AnalyticsConsent(){
  const pathname=usePathname();
  const [choice,setChoice]=useState("loading");
  const [open,setOpen]=useState(false);

  useEffect(()=>{
    if(!measurementId){setChoice("unavailable");return;}
    ensureDataLayer();
    window.gtag("consent","default",{analytics_storage:"denied",ad_storage:"denied",ad_user_data:"denied",ad_personalization:"denied",wait_for_update:500});
    const saved=localStorage.getItem(STORAGE_KEY);
    if(saved==="granted"||saved==="denied"){
      setChoice(saved);applyConsent(saved);if(saved==="granted")loadGa4();
    }else setChoice("unset");
  },[]);

  useEffect(()=>{
    if(choice!=="granted"||!measurementId||typeof window.gtag!=="function")return;
    window.gtag("event","page_view",{page_path:pathname,page_location:window.location.href,page_title:document.title});
  },[pathname,choice]);

  if(choice==="loading"||choice==="unavailable")return null;

  const save=value=>{
    localStorage.setItem(STORAGE_KEY,value);
    setChoice(value);setOpen(false);applyConsent(value);if(value==="granted")loadGa4();
  };

  if(choice!=="unset"&&!open){
    return <button type="button" onClick={()=>setOpen(true)} aria-label="Çerez tercihlerini değiştir" style={{position:"fixed",left:14,bottom:14,zIndex:80,border:"1px solid #285365",background:"#081d28",color:"#bcd0d6",borderRadius:999,padding:"8px 11px",fontSize:12}}>Çerez tercihleri</button>;
  }

  return <section role="dialog" aria-label="Analitik çerez tercihleri" style={{position:"fixed",left:16,right:16,bottom:16,zIndex:100,maxWidth:640,margin:"0 auto",background:"#071c27",border:"1px solid #285365",borderRadius:18,padding:18,boxShadow:"0 18px 55px #0009"}}>
    <strong style={{display:"block",fontSize:17,marginBottom:7}}>Çerez tercihleri</strong>
    <p style={{margin:"0 0 14px",lineHeight:1.55,color:"#a8bcc3",fontSize:14}}>Zorunlu çerezler site ve hesap güvenliği için kullanılır. Analitik çerezler yalnız izninle etkinleşir ve site kullanımını, ön değerlendirme başvurularını ve dönüşüm akışını ölçmemize yardımcı olur. Reklam kişiselleştirmesi kullanmıyoruz.</p>
    <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
      <button type="button" onClick={()=>save("denied")} style={{background:"transparent",border:"1px solid #41616d",color:"#e6f1f3",padding:"10px 14px",borderRadius:10}}>Yalnız zorunlu</button>
      <button type="button" onClick={()=>save("granted")} style={{background:"linear-gradient(90deg,#3f8cff,#2fd1b9)",border:0,color:"white",fontWeight:800,padding:"10px 14px",borderRadius:10}}>Analitiğe izin ver</button>
      {choice!=="unset"&&<button type="button" onClick={()=>setOpen(false)} style={{background:"transparent",border:0,color:"#9db2ba",padding:"10px 6px"}}>Kapat</button>}
    </div>
    <a href="/gizlilik" style={{display:"inline-block",marginTop:12,fontSize:12}}>Gizlilik politikasını incele →</a>
  </section>;
}
