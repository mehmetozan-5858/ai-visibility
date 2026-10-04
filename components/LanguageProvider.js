"use client";
import {createContext,useContext,useEffect,useMemo,useState} from "react";

const LanguageContext=createContext(null);

const dictionaries={
  tr:{
    home:"Ana Sayfa",clients:"Müşteriler",business:"İşletme",scans:"Taramalar",reports:"Raporlar",agents:"Ajanlar",settings:"Ayarlar",
    liveProtected:"● CANLI / KORUMALI",adminPanel:"GEO / AEO YÖNETİM PANELİ",customerPanel:"MÜŞTERİ PANELİ",
    logout:"Çıkış",loggingOut:"Çıkılıyor…",language:"Dil",turkish:"Türkçe",english:"English",
    customerLogin:"Müşteri Girişi",customerLoginSubtitle:"AI Visibility müşteri paneli",email:"E-posta",password:"Şifre",
    signIn:"Giriş yap",signingIn:"Giriş yapılıyor…",forgotPassword:"Şifremi unuttum",firstTime:"İlk kez mi geliyorsunuz?",
    firstTimeText:"Yeni müşteriyseniz ön değerlendirme ve güvenli hesap oluşturma sürecini buradan başlatın.",
    createAccount:"Yeni müşteriyim / Hesabımı oluştur",viewDemo:"Önce demo panelini incele",
    loginFailed:"Giriş yapılamadı.",selectClient:"Bir müşteri seçmelisiniz.",clientNotFound:"Müşteri bulunamadı.",
    noCompletedScan:"Bu müşteri için tamamlanmış tarama bulunamadı.",unknownError:"Bilinmeyen hata",
    contentPlanFailed:"İçerik planı üretilemedi.",implementationFailed:"Uygulama paketi hazırlanamadı."
  },
  en:{
    home:"Home",clients:"Clients",business:"Business",scans:"Scans",reports:"Reports",agents:"Agents",settings:"Settings",
    liveProtected:"● LIVE / PROTECTED",adminPanel:"GEO / AEO MANAGEMENT PANEL",customerPanel:"CUSTOMER PORTAL",
    logout:"Log out",loggingOut:"Logging out…",language:"Language",turkish:"Türkçe",english:"English",
    customerLogin:"Customer Login",customerLoginSubtitle:"AI Visibility customer portal",email:"Email",password:"Password",
    signIn:"Sign in",signingIn:"Signing in…",forgotPassword:"Forgot password",firstTime:"Is this your first visit?",
    firstTimeText:"If you are a new customer, start your initial assessment and secure account setup here.",
    createAccount:"I’m a new customer / Create my account",viewDemo:"View the demo first",
    loginFailed:"Unable to sign in.",selectClient:"Please select a client.",clientNotFound:"Client not found.",
    noCompletedScan:"No completed scan was found for this client.",unknownError:"Unknown error",
    contentPlanFailed:"Content plan could not be generated.",implementationFailed:"Implementation package could not be prepared."
  }
};

export function LanguageProvider({children}){
  const [lang,setLang]=useState("tr");
  useEffect(()=>{
    const cookie=document.cookie.match(/(?:^|; )ai_lang=(tr|en)/)?.[1];
    const stored=localStorage.getItem("ai_lang");
    const browser=(navigator.language||"").toLowerCase().startsWith("en")?"en":"tr";
    const initial=cookie||stored||browser;
    setLang(initial);
    document.documentElement.lang=initial;
  },[]);
  function changeLanguage(next){
    if(!["tr","en"].includes(next))return;
    setLang(next);localStorage.setItem("ai_lang",next);document.cookie=`ai_lang=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;document.documentElement.lang=next;
  }
  const value=useMemo(()=>({lang,setLang:changeLanguage,t:(key)=>dictionaries[lang]?.[key]??dictionaries.tr[key]??key}),[lang]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(){
  const ctx=useContext(LanguageContext);
  if(!ctx)throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}

export function LanguageSwitcher(){
  const {lang,setLang,t}=useLanguage();
  return <label style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:12}} aria-label={t("language")}>
    <span style={{opacity:.7}}>{t("language")}</span>
    <select value={lang} onChange={e=>setLang(e.target.value)} style={{minHeight:34,padding:"4px 8px",borderRadius:8}}>
      <option value="tr">TR</option><option value="en">EN</option>
    </select>
  </label>;
}
