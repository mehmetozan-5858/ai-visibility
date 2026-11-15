"use client";
import {useState} from "react";
import Link from "next/link";

const messages={
  "credential-and-price-confirmed":"OpenRouter anahtarı kabul edildi; modelin katalog fiyatı sıfır. Kota ve gerçek AI yanıtı doğrulanmadı.",
  "credential-rejected":"OpenRouter anahtarı kabul edilmedi. Sunucu ayarlarını yetkili ortamda inceleyin.",
  "not-configured":"Ücretsiz sağlayıcı ayarı eksik; AI isteği başlatılmadı.",
  "model-not-verified-free":"Modelin sıfır fiyatlı olduğu doğrulanmadı; AI isteği başlatılmadı.",
  "credential-check-unavailable":"Anahtar doğrulaması yapılamadı.",
  "catalog-unavailable":"Anahtar kabul edildi; model kataloğu doğrulanamadı.",
  "preflight-unavailable":"Sağlayıcı bağlantı kontrolü tamamlanamadı."
};
export default function OpenRouterKontrol(){
 const [busy,setBusy]=useState(false),[result,setResult]=useState(null),[error,setError]=useState("");
 async function check(){
  setBusy(true);setResult(null);setError("");
  try{
   const response=await fetch("/api/admin/free-provider-preflight",{method:"GET",credentials:"same-origin",cache:"no-store"});
   if(response.status===401||response.status===403){setError("Yönetici oturumu gerekli veya yetki reddedildi.");return}
   if(response.status===429){setError("İstek sınırı doldu. Otomatik tekrar yapılmadı.");return}
   if(!response.ok){setError("Güvenli bağlantı kontrolü başarısız. HTTP "+response.status);return}
   const data=await response.json();
   setResult({state:typeof data.state==="string"?data.state:"unknown",credentialAccepted:data.credentialAccepted===true,modelFree:data.modelFree===true,quotaVerified:data.quotaVerified===true});
  }catch{setError("Bağlantı kontrolüne ulaşılamadı. Otomatik tekrar yapılmadı.")}
  finally{setBusy(false)}
 }
 return <main style={{maxWidth:680,margin:"auto",padding:24}}>
  <Link href="/admin">Yönetici paneline dön</Link>
  <h1>OpenRouter ücretsiz bağlantı kontrolü</h1>
  <p>Bu kontrol müşteri veya işletme kaydı oluşturmaz, şifre değiştirmez, ödeme yapmaz ve AI yanıtı istemez. Yönetici oturumu gerekir.</p>
  <button type="button" disabled={busy} onClick={check}>{busy?"Denetleniyor…":"Bağlantıyı güvenle denetle"}</button>
  {error&&<p role="alert">{error}</p>}
  {result&&<section aria-live="polite">
   <p><strong>Sonuç:</strong> {messages[result.state]||"Doğrulanamayan sağlayıcı durumu; AI isteği başlatılmadı."}</p>
   <p>Anahtar: {result.credentialAccepted?"Kabul edildi":"Doğrulanmadı"} | Sıfır fiyat: {result.modelFree?"Doğrulandı":"Doğrulanmadı"} | Kota: {result.quotaVerified?"Doğrulandı":"Doğrulanmadı"}</p>
   <p>Gerçek müşteri raporu ve saklanan sıfır maliyetli AI yanıtı bu kontrolün kapsamı dışındadır.</p>
  </section>}
 </main>;
}
