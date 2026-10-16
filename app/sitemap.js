const origin="https://www.aivisibilityworks.com";
const pages=["/","/hizmetler","/metodoloji","/yapay-zeka-gorunurlugu","/hakkimizda","/iletisim","/demo","/yeni-musteri","/gizlilik","/kvkk","/iptal-iade","/mesafeli-hizmet-sozlesmesi"];

export default function sitemap(){
  return pages.map(path=>({
    url:path==="/"?`${origin}/`:`${origin}${path}`,
  }));
}
