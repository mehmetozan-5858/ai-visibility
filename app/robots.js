function siteOrigin(){
  const explicit=String(process.env.NEXT_PUBLIC_SITE_URL||"").trim().replace(/\/$/,"");
  if(explicit)return explicit;
  const vercel=String(process.env.VERCEL_PROJECT_PRODUCTION_URL||"").trim();
  return vercel?`https://${vercel}`:"https://ai-visibility.vercel.app";
}

export default function robots(){
  const origin=siteOrigin();
  return {
    rules:[{
      userAgent:"*",
      allow:"/",
      disallow:[
        "/admin",
        "/login",
        "/lead-finder",
        "/musteriler",
        "/ajanlar",
        "/taramalar",
        "/raporlar",
        "/ayarlar",
        "/musteri-panel",
        "/site-preview",
        "/portal-preview",
        "/api/"
      ]
    }],
    sitemap:`${origin}/sitemap.xml`,
    host:origin
  };
}
