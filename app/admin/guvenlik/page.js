"use client";
import {useState} from "react";
export default function Page(){
  const [password,setPassword]=useState(""),[code,setCode]=useState(""),[secret,setSecret]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
  async function submit(action){
    setBusy(true);setMessage("");
    try{
      const res=await fetch("/api/admin/totp-setup",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action,password,code})});
      const data=await res.json();if(!res.ok)throw new Error(data.error||"İşlem başarısız.");
      if(action==="show"){setSecret(data.secret);setMessage("Authenticator uygulamasında + → Kurulum anahtarı gir seçeneğini kullanın.")}
      else setMessage(data.verified?"Kod doğru. Kurulumu etkinleştirmemiz için bana 'Authenticator doğrulandı' yazın.":"Kod hatalı. Telefon saatinizi kontrol edip tekrar deneyin.");
    }catch(e){setMessage(e.message)}finally{setBusy(false)}
  }
  return <main className="panel scan-form" style={{maxWidth:520,margin:"50px auto"}}>
    <h1>Ücretsiz Authenticator kurulumu</h1>
    <p>Google Authenticator, Microsoft Authenticator veya iPhone Parolalar uygulamasına hesap ekleyebilirsiniz. Kurulum anahtarını kimseyle paylaşmayın.</p>
    <label>Mevcut yönetici şifresi<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
    <button type="button" disabled={busy||!password} onClick={()=>submit("show")}>Kurulum anahtarını göster</button>
    {secret&&<><p>Hesap adı: <b>AI Visibility</b></p><label>Gizli kurulum anahtarı<input readOnly value={secret} autoComplete="off"/></label>
      <p>Tür: Zamana dayalı (TOTP), 6 hane, 30 saniye.</p>
      <label>Uygulamada görünen 6 haneli kod<input inputMode="numeric" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))}/></label>
      <button type="button" disabled={busy||code.length!==6} onClick={()=>submit("verify")}>Kodu test et</button></>}
    {message&&<p role="status">{message}</p>}
    <a href="/admin">Yönetim paneline dön</a>
  </main>;
}
