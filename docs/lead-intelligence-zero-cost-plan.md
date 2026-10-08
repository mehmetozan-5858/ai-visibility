# Lead Intelligence — düşük maliyetli uygulama planı

## Amaç
AI Visibility için 500 aday keşfi → doğrulanmış sinyallerle sıralama → en uygun 50 aday → kişiselleştirilmiş erişim → günlük yönetici raporu. Mevcut 20 iş paketinin sırasını değiştirmez.

## Veri ve kanıt
Her aday: şirket, ülke/şehir, sektör, site, kaynak URL, kontrol tarihi, görünürlük sorunu, doğrulanmış büyüme sinyali, iletişim kanalı, kanıt güveni, iletişim durumu. Eksik veri uydurulmaz; belirsiz olarak işaretlenir. Robots.txt, hız sınırları, KVKK/GDPR ve iletişim kurallarına uyulur.

## Puanlama (0-100)
- Kanıtlanmış çözülebilir görünürlük problemi: 35
- Satın alma niyeti / güncel ticari sinyal: 25
- Ödeme kapasitesi için kamuya açık vekil göstergeler: 20
- Ulaşılabilirlik ve iletişim doğruluğu: 10
- Ülke/sektör stratejik uyumu: 10
Kanıt yoksa ilgili puan 0; her puanın kaynak URL'si ve açıklaması tutulur. Eşikler ilk gerçek sonuçlara göre kalibre edilir.

## Maliyet koruması
Önce ücretsiz ve izinli açık veri, deterministik web kontrolleri, önbellek ve tekilleştirme. Yalnız ilk sıralamadaki adaylarda LLM çağrısı; günlük çağrı, token, tarama ve e-posta üst limitleri; bütçe aşımında otomatik durdurma. Ücretli veri sağlayıcısı ve yüksek hacimli otomasyon için gelir sonrası ayrı onay.

## Akış
Keşif → tekilleştirme → kanıt toplama → skor → ilk 50 → taslak mesaj → gönderim uygunluğu ve güvenlik kontrolü → izinli gönderim → yanıt takibi → günlük özet. Gerçek gönderim ve entegrasyonlar ancak kimlik doğrulama, opt-out, teslim edilebilirlik ve uygun yasal dayanak test edilince açılır.

## Ölçümler
Keşfedilen aday, doğrulanmış aday, ilk 50 kanıt oranı, gönderim, teslim, olumlu yanıt, toplantı, teklif, ücretli dönüşüm, müşteri edinme maliyeti. Başarı oranları ölçülmeden tahmin diye sunulmaz.

## Kapanış şartı
Kod + test + canlı ortam doğrulaması. Bu belge tek başına çalışan özellik değildir.
