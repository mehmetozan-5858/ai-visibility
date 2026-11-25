// Pure, offline German order-guide draft. No external calls or customer storage.
export function buildOrderGuideDraft({brand, whatsappUrl, article} = {}) {
  if(typeof brand !== 'string' || !brand.trim() || brand.length>100 || /[\r\n<>]/.test(brand)) throw new TypeError('Invalid brand');
  let link=null;
  if(whatsappUrl) {
    const u=new URL(whatsappUrl);
    if(u.protocol!=='https:' || u.hostname!=='wa.me' || u.username || u.password || u.port || u.search || u.hash || !/^\/[1-9]\d{6,14}$/.test(u.pathname)) throw new TypeError('Invalid WhatsApp link');
    link=u.href;
  }
  const fields=['code','sizes','price','delivery'];
  const missing=fields.filter(k=>typeof article?.[k]!=='string'||!article[k].trim());
  if(!link) missing.unshift('whatsappUrl');
  return {language:'de',status:'draft',publicationApproved:false,brand:brand.trim(),title:'So einfach bestellst du bei uns',steps:['Wähle deinen gewünschten Artikel.','Notiere den Artikelcode und deine gewünschte Größe.','Sende uns deine Anfrage per WhatsApp.','Wir informieren dich über Verfügbarkeit, Preis und den weiteren Ablauf.'],message:'Hallo, ich interessiere mich für folgenden Artikel:\nArtikelcode:\nGröße:\nFarbe:\nIst der Artikel verfügbar? Wie viel kostet er und welche Versand- oder Abholmöglichkeiten gibt es?',whatsappUrl:link,missing};
}
