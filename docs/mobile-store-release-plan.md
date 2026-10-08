# AI Visibility — mobil mağaza yayın planı
Tarih: 8 Ekim 2026. Durum: hazırlık; mağazaya gönderim veya imzalı mobil paket yok.

## İlk sürüm kapsamı
Önerilen ürün: mevcut müşteriler için rapor ve görev takip uygulaması.
Mevcut web girişleri: /musteri-giris, /musteri-panel, /musteri-panel/rapor.
Yönetici, aday havuzu, ajan merkezi ve toplu e-posta operasyonu web yönetiminde kalır.
TR/EN arayüz, rapor detayları, yerel PDF paylaşımı, erişim/onay görevleri, bağlantı kaybı ekranı, güvenli oturum ve hesap yönetimi.
Bildirimler yalnız gerçek olaylar ve kullanıcı izniyle; sunucu entegrasyonu tamamlanmadan çalışıyor denmez.
Kaynaklı ön değerlendirme ile gerçek AI ölçümü ayrı gösterilir.

## Mimari kararı
Next.js web ve sunucu mevcut yerinde korunur. Yeni mobil istemci ayrı dizin/proje olarak mevcut sunucunun yetkilendirilmiş müşteri API'lerini kullanır.
Yerelde paketlenmiş arayüz + native cihaz özellikleri hedeflenir. Capacitor ile ayrı istemci veya React Native değerlendirilecek.
Sunuculu Next.js projesi doğrudan statik export edilmez; yalnız uzak siteyi gösteren WebView final ürün sayılmaz.
Mobil oturum, API yetkilendirmesi, müşteri veri izolasyonu ve PDF erişimi ayrı uçtan uca doğrulanır.
Hiçbir admin anahtarı, servis tokenı veya sağlayıcı sırrı mobil pakete eklenmez.

## Ödeme kararı — yayın engeli
Ücretsiz web hizmeti eşlikçisi modeli adaydır: mevcut hakların takibi; mobil uygulama içinde satın alma veya dışarı satın alma çağrısı yok.
Bu model için Apple 3.1.3(f) uygunluğu ve Google Play ödeme politikası ayrı doğrulanacak; otomatik istisna varsayılmaz.
Mobilde dijital rapor/abonelik satışı istenirse mağaza ödeme sistemi, ürünler, makbuz doğrulama, geri yükleme ve hak eşleştirmesi uygulanır; bölgesel istisnalar ayrıca incelenir.
Webdeki IBAN/Shopier bağlantısı mobilde dijital kilit açma için doğrudan taşınmaz.

## Sıralı işler
1. Müşteri ekranları/API'ler: mevcut uygulamayı oku; kimlik, veri izolasyonu, hesap silme ve ödeme ekranlarını denetle.
2. Mobil istemci: güvenli giriş, rapor listesi/detayı, görev/onay, yerel paylaşım ve bağlantı kaybı.
3. Gerçek cihaz doğrulaması: iPhone + Android, geri düğmesi, safe area, oturum yenileme, PDF, yetkisiz erişim ve başka müşterinin verisi.
4. Mağaza paketi: ikon ana görseli, ekran görüntüleri, TR/EN açıklamalar, destek URL, gizlilik ve gerçek veri envanteri.
5. Hesaplar ve imzalama: kullanıcı kendi Apple/Google hesabında kayıt, kimlik doğrulama ve ücretleri tamamlar. Şifreler/2FA sohbetten istenmez.
6. TestFlight ve Google kapalı test, ardından üretim başvurusu. İnceleme için sınırlı demo müşteri hesabı ve anlaşılır notlar.
7. Onay ve mağaza URL'si görülmeden yayın tamamlandı denmez.

## Hesap ve test koşulları (8 Ekim 2026 resmî kaynaklar)
Apple Developer: yıllık 99 USD, yerel ücret değişebilir; bireysel üyelikte satıcı kişisel yasal ad olabilir.
Google Play Console: tek sefer 25 USD.
13 Kasım 2023 sonrası açılan kişisel Google hesaplarında en az 12 testçi, kesintisiz en az 14 gün kapalı test; sonra üretim erişimi başvurusu.
Geliştirici hesabı sahipliği, imzalama, test cihazları ve testçi listesi henüz doğrulanmadı.

## Kaynaklar
https://developer.apple.com/help/account/membership/program-enrollment
https://developer.apple.com/app-store/review/guidelines/ (4.2; 3.1.1; 3.1.3(f); 5.1.1)
https://support.google.com/googleplay/android-developer/answer/6112435
https://support.google.com/googleplay/android-developer/answer/14151465

## Tamamlanma kanıtı
İmzalı iOS/Android paketler + gerçek cihaz akışları + mağaza gizlilik/ödeme doğrulaması + test sonucu + mağaza inceleme sonucu gerekir.
Web ikon commit'i c3f131fb7873ec7b9cf896eb6039fe01a114e036. Bu yalnız web ikonudur; native mağaza yayını değildir.
