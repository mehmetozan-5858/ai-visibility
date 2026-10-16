"use client";
import {useState} from "react";

export default function LaunchQAConsole(){
  const [phase,setPhase]=useState("idle"),[result,setResult]=useState(null),[code,setCode]=useState(""),[error,setError]=useState("");
  const busy=phase==="starting"||phase==="finishing";

  async function call(body){
    const response=await fetch("/api/admin-test-flow",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
    const data=await response.json();
    if(!response.ok)throw new Error(data?.error||"Lansman testi çalıştırılamadı.");
    return data;
  }

  async function start(){
    setPhase("starting");setError("");setResult(null);setCode("");
    try{const data=await call({action:"start"});setResult(data);setPhase("code");}
    catch(e){setError(e?.message||"Test başlatılamadı.");setPhase("idle");}
  }

  async function finish(e){
    e.preventDefault();
    const clean=String(code).replace(/\D/g,"").slice(0,6);
    if(clean.length!==6){setError("E-postaya gelen 6 haneli kodu girin.");return;}
    setPhase("finishing");setError("");
    try{const data=await call({action:"finish",code:clean});setResult(prev=>({...prev,...data}));setPhase("done");}
    catch(e){setError(e?.message||"Test tamamlanamadı.");setPhase("code");}
  }

  return <div style={{display:"grid",gap:16}}>
    <section className="panel">
      <div style={{fontSize:11,letterSpacing:".16em",fontWeight:900,color:"#54dfd0",textTransform:"uppercase",marginBottom:8}}>Production E2E</div>
      <h2 style={{marginTop:0}}>Sentetik müşteri lansman testi</h2>
      <p>Gerçek müşteri verisi veya gerçek tahsilat kullanmadan; müşteri kaydı, test taraması, ödeme durumu, e-posta doğrulaması ve müşteri hesabı kurulumunu production veritabanında kontrollü olarak doğrular.</p>
      <button type="button" onClick={start} disabled={busy}>{phase==="starting"?"Test hazırlanıyor…":"Lansman testini başlat"}</button>
      {error&&<p className="client-message" role="alert" style={{marginTop:12}}>{error}</p>}
    </section>

    {result?.action==="start"&&phase!=="done"&&<section className="panel">
      <h2>E-posta doğrulaması</h2>
      <p>Test verisi hazırlandı. Doğrulama kodu <b>{result.emailMasked||"yönetici e-postası"}</b> adresine gönderildi.</p>
      <dl style={{display:"grid",gridTemplateColumns:"max-content 1fr",gap:"8px 16px"}}>
        <dt>Müşteri</dt><dd>{result.client?.name}</dd>
        <dt>Test skoru</dt><dd>{result.expectedScore}</dd>
        <dt>Ödeme durumu</dt><dd>{result.paymentStatus}</dd>
      </dl>
      <form onSubmit={finish} style={{display:"flex",gap:10,alignItems:"end",flexWrap:"wrap",marginTop:16}}>
        <label style={{display:"grid",gap:6}}>6 haneli kod<input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} required/></label>
        <button disabled={busy||code.length!==6}>{phase==="finishing"?"Doğrulanıyor…":"Hesabı oluştur ve testi bitir"}</button>
      </form>
    </section>}

    {phase==="done"&&<section className="panel">
      <div style={{fontSize:11,letterSpacing:".16em",fontWeight:900,color:'#54dfd0',textTransform:"uppercase",marginBottom:8}}>E2E başarılı</div>
      <h2 style={{marginTop:0}}>Sentetik müşteri hesabı oluşturuldu</h2>
      <p>Bu bilgiler yalnız kontrollü test hesabına aittir. Şifre bu ekranda tek sefer gösterilir; gerçek müşteri hesabına dokunulmaz.</p>
      <dl style={{display:"grid",gridTemplateColumns:"max-content 1fr",gap:"8px 16px",overflowWrap:"anywhere"}}>
        <dt>E-posta</dt><dd>{result.email}</dd>
        <dt>Geçici test şifresi</dt><dd><code>{result.password}</code></dd>
        <dt>Test müşterisi</dt><dd>{result.client?.name}</dd>
      </dl>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:16}}>
        <a className="button" href="/musteri-giris" target="_blank" rel="noreferrer">Müşteri girişini aç</a>
        {result.paymentUrl&&<a href={result.paymentUrl} target="_blank" rel="noreferrer">Test ödeme kaydını görüntüle</a>}
      </div>
    </section>}

    <section className="panel">
      <h2>Canlı ödeme güvenliği</h2>
      <p>Bu konsol Paddle’da gerçek tahsilat veya gerçek kart işlemi başlatmaz. Paddle production checkout’un provider seviyesinde açılma kontrolü ayrı tutulur ve müşteri açıkça ödeme düğmesine basmadan transaction oluşturulmaz.</p>
    </section>
  </div>;
}
