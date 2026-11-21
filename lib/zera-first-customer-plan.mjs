const work = {
  contact: {
    title: 'Profil ve randevu',
    requires: 'Teyitli işletme adı, açık adres, giriş bilgisi, görüşme saatleri ve randevu kanalı.',
    draft: 'Profil adı: ZERA | Damenmode Wetzlar. Biyografi: Mode in Wetzlar · Showroom nach Termin · Termine per [bestätigter Kontaktweg].',
    accept: 'iPhone’da profil başlığından doğru randevu hedefine ulaşılır. Adres ve randevu bilgileri işletmenin teyidiyle eşleşir.'
  },
  conversion: {
    title: 'Sipariş rehberi',
    requires: 'Ürün kodu, beden, stok, fiyat, teslimat ve iade bilgileri ile teyitli WhatsApp hedefi.',
    draft: 'So bestellst du: Sende uns den Artikelcode [Code], deine Größe und deinen Wunsch zur Abholung oder Lieferung. Wir bestätigen Verfügbarkeit und Gesamtpreis.',
    accept: 'Ürün örneğinden doğru mesaj hedefine geçilir ve mesaj gönderilmeden ürün kodu kontrol edilir.'
  },
  content: {
    title: 'Ürün kartları ve sabit içerikler',
    requires: 'Görsel kullanım izni, ürün adı, kod, beden, fiyat ve stok bilgisi.',
    draft: 'Sabit gönderiler: Termin & Showroom · So bestellst du · Aktuelle Kollektion. Ürün kartı: [Artikelname] · [Code] · [Größen] · [Preis] · [Verfügbarkeit].',
    accept: 'Onaylı üç ürünün kod, beden ve fiyatı kartlarla eşleşir. Randevu ve sipariş rehberleri profilde bulunabilir.'
  },
  website: {
    title: 'Mobil site ve katalog',
    requires: 'Varsa mevcut alan adı, marka varlıkları, onaylı ürün bilgileri ve işletmenin onayladığı sayfa metinleri.',
    draft: 'Almanca sayfa yapısı: Startseite, Kollektion, Termin & Showroom, Kontakt. İlk ekran: Damenmode in Wetzlar · Kollektion ansehen · Termin anfragen.',
    accept: 'iPhone’da koleksiyon, randevu ve iletişim yolları çalışır. Teyitli alan adı üzerinden açılır.'
  },
  google: {
    title: 'Google ve yerel bulunabilirlik',
    requires: 'Teyitli adres ve giriş, varsa mevcut Google İşletme Profili URL’si ve işletme sahibinin yetki teyidi.',
    draft: 'Profil taslağı: [Bestätigter Unternehmensname] · [Bestätigte Adresse] · Showroom nach Termin · [Kontakt]. Wetzlar marka ve yerel sorguları için başlangıç kayıt tablosu.',
    accept: 'Mevcut eşleşme ve harita işareti teyit edilir. Marka ve yerel sorgular aynı konum ve cihaz koşullarında tarihli kaydedilir.'
  },
  trust: {
    title: 'Güven ve işletme bilgileri',
    requires: 'Yayımlanabilir işletme bilgileri, onaylı teslimat ve iade metinleri, varsa izinli yorum örneği.',
    draft: 'Über ZERA · Showroom & Kontakt · Bestellung, Abholung, Lieferung und Rückgabe. Her bölümde işletmenin onaylı metni yer alır.',
    accept: 'Yayımlanan işletme ve sipariş bilgileri onaylı metinle eşleşir. Kullanılan yorumun kaynağı ve izni dosyalanır.'
  },
  seo: {
    title: 'Teknik SEO kabulü',
    requires: 'Teyitli site URL’si. Varsa Search Console dışa aktarımı.',
    draft: 'Ana sayfa başlık örneği: ZERA | Damenmode in Wetzlar. Kontrol listesi: HTTPS, mobil görünüm, canonical, robots, sitemap ve indeks durumu.',
    accept: 'Resmî URL’nin teknik kontrolleri tarihli kaydedilir. İndeks durumu eldeki yetkili veriyle doğrulanır.'
  },
  social: {
    title: 'Sosyal kanal envanteri',
    requires: 'Resmî kanal bağlantıları, hedef kitle ve içerik sorumlusu.',
    draft: 'Kanal listesi: Instagram · [teyitli ek kanal]. İlk deneme: bir ürün videosu, Almanca açıklama, tek randevu veya sipariş çağrısı.',
    accept: 'Yalnızca ZERA’ya ait olduğu teyit edilen kanallar listelenir. Filtrelenmiş tıklama ve talep verileri varsa kaydedilir.'
  }
};

export function selectZeraWork(findingIds, selections) {
  const available = new Set(findingIds);
  const wanted = new Set(selections);
  return Object.entries(work)
    .filter(([id]) => available.has(id) && wanted.has(id))
    .map(([id, item]) => ({id, ...item}));
}

export function summarizeZeraTrial(plan, records) {
  const items = plan.map(item => {
    const record = records[item.id];
    const note = typeof record?.note === 'string' ? record.note.trim() : '';
    const status = note && ['passed', 'needsRevision'].includes(record?.status) ? record.status : 'pending';
    return {...item, status, note};
  });
  const passed = items.filter(item => item.status === 'passed').length;
  return {items, passed, pending: items.length - passed, ready: items.length > 0 && passed === items.length};
}
