"use client";
import {useEffect,useState} from "react";
import {formatLaunchQaTime,markLaunchQaStage,readLaunchQaStatus} from "../lib/launch-qa-status";

const labels={
  database:"Veritabanı",dashboard:"Dashboard",clients:"Müşteriler",scans:"Taramalar",crm:"Satış CRM",workItems:"İş / Onay",payments:"Ödemeler",providers:"AI sağlayıcıları",auth:"Yönetici koruması",paytr:"PayTR"
};

export default function TestCenter(){
  const [busy,setBusy]=useState(false),[data,setData]=useState(null),[msg,setMsg]=useState("");
  const [e2eBusy,setE2eBusy]=useState(false),[e2eStep,setE2eStep]=useState("idle"),[e2eMsg,setE2eMsg]=useState(""),[code,setCode]=useState(""),[emailMasked,setEmailMasked]=useState("");
  const [lastStage5At,setLastStage5At]=useState("");

  useEffect(()=>{
    const saved=readLaunchQaStatus();
    if(saved.stage5At){
      setLastStage5At(saved.stage5At);
      setE2eStep("done");
      setE2eMsg(`✓ 5. aşama daha önce production ortamında başarıyla tamamlandı (${formatLaunchQaTime(saved.stage5At)}). İsterseniz testi tekrar çalıştırabilirsiniz.`);
    }
  },[]);

  async function run(){
    setBusy(true);setMsg("");
    try{
      const r=await fetch("/api/health",{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"Test merkezi çalıştırılamadı.");
      setData(d);setMsg(d.ok?"Ana sistem kontrolleri başarıyla tamamlandı.":"Bir veya daha fazla kontrolde sorun bulundu.");
    }catch(e){setMsg(e.message)}finally{setBusy(false)}
  }
  async function startCustomerE2E(){
    setE2eBusy(true);setE2eMsg("");setCode("");
    try{
      const r=await fetch("/api/admin-test-flow",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"start"})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"Müşteri testi başlatılamadı.");
      setEmailMasked(d.emailMasked||"");setE2eStep("code");setE2eMsg(`Doğrulama kodu ${d.emailMasked||"yönetici e-postasına"} gönderildi. E-postadaki 6 haneli kodu aşağıya girin.`);
    }catch(e){setE2eStep(lastStage5At?"done":"idle");setE2eMsg(e.message)}finally{setE2eBusy(false)}
  }
  async function finishCustomerE2E(){
    if(code.replace(/\D/g,"").length!==6){setE2eMsg("6 haneli kodu girin.");return}
    setE2eBusy(true);setE2eMsg("Hesap, giriş, panel ve PDF rapor uçtan uca kontrol ediliyor…");
    try{
      const finish=await fetch("/api/admin-test-flow",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"finish",code})});
      const f=await finish.json();if(!finish.ok)throw new Error(f.error||"Kod doğrulanamadı.");
      const login=await fetch("/api/client-auth/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:f.email,password:f.password})});
      const loginData=await login.json();if(!login.ok||!loginData.ok)throw new Error(loginData.error||"Gerçek müşteri girişi başarısız.");
      const portal=await fetch("/api/client-portal",{cache:"no-store"});const portalData=await portal.json();if(!portal.ok)throw new Error(portalData.error||"Müşteri paneli API kontrolü başarısız.");
      if(portalData.account?.client?.domain!=="test.ai-visibility.local")throw new Error("Test hesabı veri izolasyonu doğrulanamadı.");
      const completed=(portalData.account?.scans||[]).find(x=>x.status==="completed"&&Number(x.score)===42);if(!completed)throw new Error("Test rapor skoru bulunamadı.");
      const panel=await fetch("/musteri-panel",{cache:"no-store"});if(!panel.ok)throw new Error("Müşteri paneli sayfası açılamadı.");
      const report=await fetch("/api/client-portal/report?download=1",{cache:"no-store"});if(!report.ok)throw new Error("PDF rapor üretilemedi.");
      if(!String(report.headers.get("content-type")||"").toLowerCase().includes("application/pdf"))throw new Error("Rapor PDF olarak dönmedi.");
      await fetch("/api/client-auth/login",{method:"DELETE"}).catch(()=>{});
      const saved=markLaunchQaStage("stage5");setLastStage5At(saved.stage5At);
      setE2eStep("done");setE2eMsg(`✓ 5. aşama tamam: e-posta doğrulama → hesap → gerçek giriş → müşteri paneli → 42/100 test verisi → PDF rapor zinciri production ortamında geçti. Gerçek ücret alınmadı. Doğrulama zamanı: ${formatLaunchQaTime(saved.stage5At)}.`);
    }catch(e){await fetch("/api/client-auth/login",{method:"DELETE"}).catch(()=>{});setE2eStep("code");setE2eMsg("× "+(e.message||"Müşteri E2E testi başarısız."));}finally{setE2eBusy(false)}
  }
  return <>
    <section className="panel test-center">
      <div className="section-title"><div><h2>Test Merkezi</h2><small>Veri değiştirmeden temel sistem kontrollerini çalıştırır</small></div><button onClick={run} disabled={busy}>{busy?"Kontrol ediliyor…":"✓ Tüm kontrolleri çalıştır"}</button></div>
      {msg&&<p className="client-message">{msg}</p>}
      {data&&<div className="client-list">{(data.checks||[]).map(x=>{const paytrPending=x.name==="paytr"&&x.ok&&x.detail?.configured===false;const authProblem=x.name==="auth"&&x.ok&&x.detail?.configured===false;const providerProblem=x.name==="providers"&&x.ok&&Array.isArray(x.detail)&&x.detail.filter(p=>p.status==="connected").length<3;const warn=paytrPending||authProblem||providerProblem;return <article className="client-row" key={x.name}><div className="client-avatar">{x.ok&&!warn?"✓":x.ok?"!":"×"}</div><div><b>{labels[x.name]||x.name}</b><small>{x.error||(paytrPending?"PayTR onayı / anahtarları bekleniyor":authProblem?"Yönetici koruması yapılandırılmamış":providerProblem?"Bazı AI sağlayıcıları bağlı değil":"Kontrol tamamlandı")}</small></div><span className={x.ok&&!warn?"ready":"waiting"}>{x.ok&&!warn?"Sağlıklı":warn?"Bekliyor":"Hata"}</span><em>{x.ms} ms</em></article>})}</div>}
    </section>
    <section className="panel test-center" style={{marginTop:16,border:"1px solid #246c72"}}>
      <div className="section-title"><div><h2>5. Aşama · Gerçek Müşteri Akışı</h2><small>Production üzerinde sentetik test müşterisi kullanır; gerçek para çekmez ve gerçek müşteri verisine dokunmaz.</small></div>{e2eStep==="done"?<span className="ready">✓ Tamamlandı</span>:<span className="waiting">Kontrol bekliyor</span>}</div>
      {lastStage5At&&<small style={{display:"block",marginBottom:12,opacity:.8}}>Son başarılı doğrulama: {formatLaunchQaTime(lastStage5At)}</small>}
      {e2eStep==="idle"&&<button onClick={startCustomerE2E} disabled={e2eBusy} style={{minHeight:48,fontSize:16,fontWeight:800}}>{e2eBusy?"Hazırlanıyor…":"5. aşama testini başlat"}</button>}
      {e2eStep==="code"&&<div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr)",gap:12,maxWidth:520,width:"100%"}}><label style={{display:"grid",gap:7,fontWeight:800}}>E-postaya gelen 6 haneli kod<input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" style={{fontSize:26,letterSpacing:8,minHeight:54}}/></label><button onClick={finishCustomerE2E} disabled={e2eBusy||code.length!==6} style={{minHeight:50,fontSize:16,fontWeight:800}}>{e2eBusy?"Uçtan uca kontrol ediliyor…":"Kodu doğrula ve 5. aşamayı bitir"}</button>{emailMasked&&<small>Kod gönderilen adres: {emailMasked}</small>}<button type="button" onClick={startCustomerE2E} disabled={e2eBusy}>Yeni doğrulama kodu gönder</button><small>Yeni kod istendiğinde önceki kod geçersiz olur. En son e-postadaki kodu 10 dakika içinde girin.</small></div>}
      {e2eStep==="done"&&<button onClick={startCustomerE2E} disabled={e2eBusy}>Testi tekrar çalıştır</button>}
      {e2eMsg&&<p className="client-message" style={{fontSize:15,lineHeight:1.6}}>{e2eMsg}</p>}
    </section>
  </>;
}
