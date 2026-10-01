"use client";
import {useState} from "react";
export default function LoginForm(){
  const [password,setPassword]=useState(""),[busy,setBusy]=useState(false),[msg,setMsg]=useState("");
  async function submit(e){
    e.preventDefault();setBusy(true);setMsg("");
    try{
      const r=await fetch("/api/auth/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({password})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||"Giriş yapılamadı.");
      window.location.href="/";
    }catch(e){setMsg(e.message)}finally{setBusy(false)}
  }
  return <form className="panel scan-form" onSubmit={submit} style={{maxWidth:440,margin:"80px auto"}}>
    <div><h1 style={{marginBottom:6}}>AI Visibility</h1><p>Yönetim paneline giriş</p></div>
    <label>Yönetici şifresi<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required/></label>
    <button disabled={busy}>{busy?"Kontrol ediliyor…":"Giriş yap"}</button>
    {msg&&<p className="client-message">{msg}</p>}
  </form>;
}
