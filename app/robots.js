export default function robots(){
  return {
    rules:{userAgent:"*",allow:"/",disallow:["/api/","/admin","/musteri-panel","/login","/sifremi-unuttum","/musteri-sifre-sifirla","/odeme","/paddle-sandbox"]},
    sitemap:"https://www.aivisibilityworks.com/sitemap.xml"
  };
}
