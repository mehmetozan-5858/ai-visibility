"use client";
import {useState} from "react";
import {useLanguage} from "./LanguageProvider";
export default function LogoutButton({compact=false}){
  const [busy,setBusy]=useState(false);const {t}=useLanguage();
  async function logout(){setBusy(true);try{await fetch("/api/auth/login",{method:"DELETE"});}finally{window.location.href="/login";}}
  return <button type="button" onClick={logout} disabled={busy} style={compact?{padding:"7px 10px",fontSize:12}:{}}>{busy?t("loggingOut"):t("logout")}</button>;
}
