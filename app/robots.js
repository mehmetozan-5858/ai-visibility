export default function robots(){
  return {
    rules:{userAgent:"*",allow:"/",disallow:["/api/","/admin","/musteri-panel","/musteri-giris","/login","/sifremi-unuttum","/musteri-sifre-sifirla","/odeme","/paddle-sandbox"]},
    sitemap:"https://www.aivisibilityworks.com/sitemap.xml"
  };
}
