"use client";
import {createContext,useContext,useEffect,useMemo,useState} from "react";

const LanguageContext=createContext(null);

const dictionaries={
  tr:{
    mainNavigation:"Ana gezinme",more:"Diğer",moreSections:"Diğer bölümler",closeNavigation:"Menüyü kapat",leadFinder:"Müşteri Bul",answerEvidence:"Yanıt Kanıtları",pendingWork:"Bekleyen İşler",
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
    mainNavigation:"Main navigation",more:"More",moreSections:"More sections",closeNavigation:"Close navigation",leadFinder:"Find prospects",answerEvidence:"Answer Evidence",pendingWork:"Pending Work",
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

// Existing screens contain some static Turkish copy that predates the shared i18n
// dictionary. This compatibility layer translates those strings centrally so the
// language switch applies across the whole admin/customer UI without touching
// customer-entered content or AI-generated report text.
const staticPairs={
  "Ana Sayfa":"Home","Müşteriler":"Clients","İşletme":"Business","Taramalar":"Scans","Raporlar":"Reports","Ajanlar":"Agents","Ayarlar":"Settings",
  "Müşteri Girişi":"Customer Login","Müşteri Paneli":"Customer Portal","MÜŞTERİ PANELİ":"CUSTOMER PORTAL","Çıkış":"Log out","Dil":"Language",
  "Müşteri":"Client","Tüm müşteriler":"All clients","Yeni müşteri":"New client","Yeni müşteri ekle":"Add new client","Kaydet":"Save","İptal":"Cancel","Sil":"Delete",
  "Raporlar":"Reports","Görünürlük değişimini, bulguları ve çözüm fırsatlarını izleyin.":"Track visibility changes, findings and solution opportunities.",
  "Bulgular":"Findings","İçerik Ajanı":"Content Agent","Uygulama Ajanı":"Implementation Agent","Tarama Geçmişi":"Scan History",
  "Bulgu → Çözüm Merkezi":"Finding → Solution Center","Seçilen müşterinin tarama bulgularını çözüm paketlerine dönüştürür.":"Turns the selected client's scan findings into solution packages.",
  "Açık":"Open","Kritik":"Critical","Yüksek":"High","Orta":"Medium","Düşük":"Low","Fiyat":"Price","Durum":"Status",
  "Talep edildi":"Requested","Teklif":"Offer","Onaylandı":"Approved","Uygulanıyor":"In progress","Çözüldü":"Resolved","Kapatıldı":"Dismissed",
  "✦ Son taramadan bulguları üret":"✦ Generate findings from latest scan","Üretiliyor…":"Generating…",
  "Bu müşteri için henüz bulgu yok. Son taramadan bulguları üretebilirsiniz.":"There are no findings for this client yet. You can generate them from the latest scan.",
  "Güncellenemedi.":"Could not be updated.","Üretilemedi.":"Could not be generated.",
  "İçerik planı için tamamlanmış bir tarama gerekiyor.":"A completed scan is required to create a content plan.",
  "İçerik planı üret":"Generate content plan","İçerik planı üretilemedi.":"Content plan could not be generated.",
  "GEO/AEO içerik planını seçilen müşterinin son tamamlanan taramasından üretir.":"Creates a GEO/AEO content plan from the selected client's latest completed scan.",
  "Otomatik: en güncel müşteri":"Automatic: latest client","Öncelikler":"Priorities","İçerik fikirleri":"Content ideas","Hızlı kazanımlar":"Quick wins",
  "Eksikleri uygulamak için tamamlanmış bir tarama gerekiyor.":"A completed scan is required to implement the findings.",
  "⚙ Eksikleri uygula":"⚙ Prepare implementation","Hazırlanıyor…":"Preparing…","Uygulama paketi hazırlanamadı.":"Implementation package could not be prepared.",
  "Tarama eksiklerini uygulanabilir teslimlere dönüştürür; dış sistem değişikliklerinden önce erişim ve müşteri onayı ister.":"Turns scan gaps into actionable deliverables; asks for access and client approval before external system changes.",
  "Uygulama paketi":"Implementation package","Hemen hazırlananlar":"Ready now","Hazır SSS":"Ready FAQ","Meta başlık":"Meta title","Meta açıklama":"Meta description",
  "Müşteriden gerekli bilgiler":"Information required from client","Teknik detayları göster":"Show technical details","Schema.org / JSON-LD kodu":"Schema.org / JSON-LD code",
  "Lokasyon sayfası":"Location page","Erişim gereken işler":"Tasks requiring access","Sonraki adımlar":"Next steps","Hazır teslim":"Ready deliverable",
  "Tarama geçmişi":"Scan history","Tarama":"Scan","Tamamlanan":"Completed","Ort. skor":"Avg. score","▤ PDF raporu indir":"▤ Download PDF report",
  "Müşteriler":"Clients","Aday işletmeleri bulun, analiz edin ve müşteriye dönüştürün.":"Find prospect businesses, analyze them and convert them into clients.",
  "İşletme Hesabı":"Business Account","İşletme geçmişi, Commerce Ready hazırlığı ve Business Impact görünümü.":"Business history, Commerce Ready preparation and Business Impact view.",
  "AI motorlarında marka görünürlüğünü ölçün.":"Measure brand visibility across AI engines.",
  "Otomasyon ekibinizin durumunu ve görevlerini izleyin.":"Monitor the status and tasks of your automation team.",
  "Bağlantılar, güvenlik ve otomasyon tercihleri.":"Connections, security and automation preferences.",
  "Ajan Günlük Raporu":"Daily Agent Report","Ajanların günlük çalışmasını tek ekrandan izleyin.":"Monitor the agents' daily work from one screen.",
  "İşletme AI Visibility":"Business AI Visibility","Sosyal Medya / Creator":"Social Media / Creator",
  "İşletme müşterileri, görünürlük, satış ve çözüm operasyonları.":"Business clients, visibility, sales and solution operations.",
  "YouTube, Instagram, TikTok, X ve diğer sosyal platformlar için ayrı ajan organizasyonu.":"A separate agent organization for YouTube, Instagram, TikTok, X and other social platforms.",
  "Genel / Satış":"Overview / Sales","Sorun Tespit Masaları":"Diagnosis Desks","Çözüm Masaları":"Solution Desks","Lead / CRM":"Lead / CRM","İş / Onay":"Work / Approval","Ajan Merkezi":"Agent Center","Günlük Rapor":"Daily Report",
  "Araştırma Ajanı":"Research Agent","Görünürlük Ajanı":"Visibility Agent","Satış Ajanı":"Sales Agent","CEO Ajanı":"CEO Agent","Koordinatör Ajan":"Coordinator Agent",
  "Pazar, rakip ve lead araştırması":"Market, competitor and lead research","GEO/AEO taramalarını yönetir":"Manages GEO/AEO scans",
  "Tarama sonuçlarından iyileştirme önerileri üretir":"Creates improvement recommendations from scan results","Eksikleri hazır içerik, schema ve görev paketine dönüştürür":"Turns gaps into ready content, schema and task packages",
  "Düşük skorlu müşterilerden teklif fırsatı üretir":"Creates offer opportunities from low-scoring clients","Yönetici özetlerini raporlar":"Reports executive summaries",
  "● Hazır":"● Ready","○ Sağlayıcı bekliyor":"○ Waiting for provider","Aç →":"Open →",
  "Bağlı":"Connected","Bağlantı yok":"Not connected","Hazır":"Ready","Bekliyor":"Waiting","Başlat":"Start","Yenile":"Refresh","Test Et":"Test","Test Merkezi":"Test Center","Sistem Durumu":"System Status","Sağlayıcılar":"Providers","Güvenlik":"Security",
  "Ödeme":"Payment","Ödemeler":"Payments","Ödeme bekliyor":"Payment pending","Ödendi":"Paid","Reddedildi":"Rejected","Beklemede":"Pending","Onayla":"Approve","Reddet":"Reject",
  "İşler":"Work","Onay gerekiyor":"Approval required","Erişim gerekiyor":"Access required","Devam ediyor":"In progress","Tamamlandı":"Completed",
  "Adaylar":"Prospects","Aday işletmeler":"Prospect businesses","İşletme adı":"Business name","Web sitesi":"Website","Ülke":"Country","Şehir":"City","Sektör":"Sector","Ara":"Search","Analiz et":"Analyze","Müşteriye dönüştür":"Convert to client",
  "Yeni tarama":"New scan","Taramayı başlat":"Start scan","Tarama başlatılıyor…":"Starting scan…","Sonuçlar":"Results","Skor":"Score","Öneriler":"Recommendations",
  "Bugün":"Today","Bulunan işletme":"Businesses found","Yeni aday":"New prospects","Taranan":"Scanned","Başarılı":"Successful","Hata":"Error","Hatalar":"Errors",
  "Görev devri":"Task handoff","Ortak çalışma alanı":"Shared workspace","Son aktiviteler":"Recent activity","Görev":"Task","Ajan":"Agent","Yardımcı ajan":"Helper agent","Not":"Note",
  "Giriş yap":"Sign in","Şifre":"Password","E-posta":"Email","Şifremi unuttum":"Forgot password","Hesap oluştur":"Create account","Devam":"Continue","Geri":"Back"
};

const reverseStatic=Object.fromEntries(Object.entries(staticPairs).map(([tr,en])=>[en,tr]));

function translateStaticText(text,lang){
  const exact=lang==="en"?staticPairs[text]:reverseStatic[text];
  if(exact)return exact;
  if(lang==="en"){
    let m=text.match(/^(\d+) bulgu eşleştirildi\.$/);if(m)return `${m[1]} findings matched.`;
    m=text.match(/^(.*) için içerik planı hazırlandı\.$/);if(m)return `Content plan prepared for ${m[1]}.`;
    m=text.match(/^(.*) için uygulama paketi hazırlandı\.$/);if(m)return `Implementation package prepared for ${m[1]}.`;
  }else{
    let m=text.match(/^(\d+) findings matched\.$/);if(m)return `${m[1]} bulgu eşleştirildi.`;
  }
  return text;
}

function applyStaticTranslations(lang){
  if(typeof document==="undefined"||!document.body)return;
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  const nodes=[];let node;
  while((node=walker.nextNode()))nodes.push(node);
  for(const n of nodes){
    const raw=n.nodeValue||"";const core=raw.trim();if(!core)continue;
    const translated=translateStaticText(core,lang);
    if(translated!==core)n.nodeValue=raw.replace(core,translated);
  }
  for(const el of document.querySelectorAll("[placeholder],[title],[aria-label]")){
    for(const attr of ["placeholder","title","aria-label"]){
      const value=el.getAttribute(attr);if(!value)continue;
      const translated=translateStaticText(value,lang);if(translated!==value)el.setAttribute(attr,translated);
    }
  }
}

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
  useEffect(()=>{
    let raf=0,applying=false;
    const run=()=>{if(applying)return;applying=true;try{applyStaticTranslations(lang)}finally{applying=false}};
    raf=requestAnimationFrame(run);
    const observer=new MutationObserver(()=>{if(applying)return;cancelAnimationFrame(raf);raf=requestAnimationFrame(run)});
    if(document.body)observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:["placeholder","title","aria-label"]});
    return ()=>{cancelAnimationFrame(raf);observer.disconnect()};
  },[lang]);
  function changeLanguage(next){
    if(!["tr","en"].includes(next))return;
    setLang(next);localStorage.setItem("ai_lang",next);document.cookie=`ai_lang=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;document.documentElement.lang=next;
  }
  const value=useMemo(()=>({lang,setLang:changeLanguage,t:(key)=>dictionaries[lang]?.[key]??dictionaries.tr[key]??translateStaticText(key,lang)}),[lang]);
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
