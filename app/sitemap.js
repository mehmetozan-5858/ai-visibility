const origin="https://www.aivisibilityworks.com";
const pages=["/","/hizmetler","/hakkimizda","/iletisim","/demo","/yeni-musteri","/gizlilik","/kvkk","/iptal-iade","/mesafeli-hizmet-sozlesmesi"];
export default function sitemap(){
  return pages.map(path=>({url:origin+(path==="/"?"":path)}));
}
