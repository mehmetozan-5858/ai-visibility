function siteOrigin(){
  const explicit=String(process.env.NEXT_PUBLIC_SITE_URL||"").trim().replace(/\/$/,"");
  if(explicit)return explicit;
  const vercel=String(process.env.VERCEL_PROJECT_PRODUCTION_URL||"").trim();
  return vercel?`https://${vercel}`:"https://ai-visibility.vercel.app";
}

export default function sitemap(){
  const origin=siteOrigin();
  const pages=[
    ["/",1,"weekly"],
    ["/hizmetler",0.9,"weekly"],
    ["/hakkimizda",0.7,"monthly"],
    ["/iletisim",0.7,"monthly"],
    ["/yeni-musteri",0.8,"weekly"],
    ["/musteri-giris",0.5,"monthly"],
    ["/gizlilik",0.3,"yearly"],
    ["/kvkk",0.3,"yearly"],
    ["/mesafeli-hizmet-sozlesmesi",0.3,"yearly"],
    ["/iptal-iade",0.3,"yearly"]
  ];
  return pages.map(([path,priority,changeFrequency])=>({
    url:`${origin}${path}`,
    lastModified:new Date(),
    changeFrequency,
    priority
  }));
}
