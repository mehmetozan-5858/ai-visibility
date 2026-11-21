export const zeraInstagram = 'https://www.instagram.com/zeraclothing.official/';
const profileDate = '2026-11-20';
const searchDate = '2026-11-21';
const queries = ['"zeraclothing.official"', '"ZERA Clothing" Germany Instagram ZERA Bekleidung',
  '"ZERA" "Wetzlar" Damenmode Showroom Instagram', '"zeraclothing.official" TikTok Facebook Pinterest YouTube'];

const baseline = [
  ['website', 'Web sitesi', 'search', 'Resmî alan adı doğrulanamadı.', 'Varsa resmî URL; yoksa alan adı planı.', 'Teyitli URL’yi profil ve işletme adıyla eşleştir.'],
  ['google', 'Google görünürlüğü', 'search', 'Eşleşen site veya işletme kaydı doğrulanamadı. Google sıralaması ölçülmedi.', 'Varsa Google Haritalar paylaşım bağlantısı.', 'Marka ve şehir sorgusunun tarihli Google sonucunu kaydet.'],
  ['social', 'Sosyal medya', 'profile', 'Instagram profili tanımlı; diğer kanallar açık arama örneklerinde doğrulanamadı.', 'Resmî kanal bağlantıları.', 'Bir ek kanalın marka ve şehir eşleşmesini kontrol et.'],
  ['contact', 'İletişim', 'profile', 'Showroom, randevu, DM ve WhatsApp görünüyordu; hedefler teyit edilmedi.', 'İş adresi, iletişim kanalları ve randevu yöntemi.', 'Onaylı bilgileri profille karşılaştır.'],
  ['trust', 'Güven unsurları', 'profile', 'Showroom görüntüsü ve geri bildirim başlığı görüldü; yorum kaynağı ve politikalar açık.', 'Onaylı işletme ve sipariş bilgileri.', 'Bir işletme bilgisini açık kaynakla karşılaştır.'],
  ['content', 'İçerik', 'profile', 'Ürün videoları görüldü; kapaklarda fiyat, beden ve model kodu kolay seçilemiyordu.', 'Bir ürün için onaylı görsel, fiyat, beden ve model kodu.', 'Bir açık gönderiyi onaylı ürün kartıyla karşılaştır.'],
  ['seo', 'Teknik SEO', 'search', 'Resmî alan adı teyitsiz. Teknik SEO ölçülmedi.', 'Varsa resmî URL ve Search Console dışa aktarımı.', 'Alan adı teyit edildiğinde ana sayfadan başla.'],
  ['conversion', 'Dönüşüm', 'profile', 'DM ve WhatsApp bağlantıları görünüyordu; sipariş ve randevu tamamlama yolu test edilmedi.', 'Onaylı randevu ve sipariş adımları.', 'Hedef bağlantıyı mesaj göndermeden mobilde kontrol et.']
];

export function buildZeraChannelReport(profileUrl) {
  let url;
  try { url = new URL(profileUrl); } catch { return null; }
  if (url.origin !== 'https://www.instagram.com' || url.username || url.password ||
      !['/zeraclothing.official', '/zeraclothing.official/'].includes(url.pathname)) return null;

  return {
    profileUrl: zeraInstagram,
    findings: baseline.map(([id, title, kind, observation, request, next]) => ({
      id, title, observation, request, next,
      status: kind === 'profile' ? 'Kısmi kanıt · tarihli profil kaydı' : 'Doğrulanamadı · açık web örneklemesi',
      date: kind === 'profile' ? profileDate : searchDate,
      source: kind === 'profile' ? { type: 'instagram', url: zeraInstagram } : { type: 'web-search', queries }
    }))
  };
}

export async function hasZeraChannelReportAccess(pool, sessionClientId, configuredClientId) {
  if (!sessionClientId || sessionClientId !== configuredClientId ||
      !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(configuredClientId)) return false;
  const result = await pool.query(`
    SELECT EXISTS (
      SELECT 1 FROM public.clients c
      JOIN public.client_pilot_access p ON p.client_id = c.id
      WHERE c.id = $1 AND c.name = 'ZERA Clothing' AND c.plan = 'Pilot'
        AND c.status <> 'payment-review' AND p.revoked_at IS NULL AND p.expires_at > NOW()
    ) AS allowed`, [sessionClientId]);
  return result.rows[0]?.allowed === true;
}
