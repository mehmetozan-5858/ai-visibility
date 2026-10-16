import PublicPage from "../../components/PublicPage";
export const metadata={alternates:{canonical:"/iletisim"},title:"AI Visibility İletişim ve Destek",description:"AI Visibility hizmet, teklif, ödeme, iptal, kişisel veri ve destek talepleri için resmi iletişim, destek kapsamı ve hizmet sağlayıcı bilgileri."};
export default function Page(){
  const controller=(process.env.DATA_CONTROLLER_NAME||"").trim();
  const email=process.env.ADMIN_RECOVERY_EMAIL||"";
  const phone=process.env.ADMIN_RECOVERY_PHONE||"";
  return <PublicPage title="AI Visibility İletişim ve Destek" subtitle="Hizmet, ödeme, raporlama, kişisel veri ve teknik destek konularında resmi iletişim kanallarımıza buradan ulaşabilirsiniz.">
    <p><b>Hizmet markası:</b> AI Visibility</p>
    <p><b>Platform:</b> AI Visibility Intelligence Platform</p>
    {controller
      ? <p><b>Yasal hizmet sağlayıcı / veri sorumlusu:</b> {controller}</p>
      : <p><b>Yasal hizmet sağlayıcı / veri sorumlusu:</b> Güncel yasal kimlik bilgisi bu sayfada yayımlanır.</p>}
    {email?<p><b>E-posta:</b> {email}</p>:<p>İletişim e-postası yapılandırılıyor.</p>}
    {phone?<p><b>Telefon:</b> {phone}</p>:null}

    <h2>Hangi konularda bize ulaşabilirsiniz?</h2>
    <p>AI Visibility ile ilgili ücretsiz ön değerlendirme başvuruları, hizmet kapsamı, paket ve teklif bilgileri, ödeme süreci, fatura veya tahsilat soruları, üyelik ve müşteri paneli erişimi, raporların anlaşılması, teknik destek, iptal ve iade talepleri ile kişisel verilerin korunmasına ilişkin başvurular için bu sayfadaki kayıtlı iletişim kanallarını kullanabilirsiniz.</p>
    <p>Bir destek talebi iletirken mümkünse kullandığınız alan adını, talebin kısa açıklamasını ve varsa ilgili ekran veya rapor adını belirtmeniz çözüm sürecini kolaylaştırır. Güvenliğiniz için parola, tek kullanımlık doğrulama kodu, kart numarası, CVV veya başka bir gizli kimlik doğrulama bilgisini e-posta ya da mesaj yoluyla göndermeyin.</p>

    <h2>Ölçüm ve raporlama desteği</h2>
    <p>Platform; yapay zekâ görünürlüğü, GEO ve AEO ölçümleri, arama ve içerik görünürlüğü, kaynak atıfları ve raporlama akışları hakkında sonuçlar üretir. Bir ölçümün ne anlama geldiği, hangi veriyle oluşturulduğu veya müşteri panelinde nerede görüntülendiği konusunda desteğe ihtiyaç duyarsanız ilgili rapor veya tarama adını paylaşarak açıklama isteyebilirsiniz. Ölçüm sonuçlarının bağlamını ve kullanılan metodolojiyi açıklamayı, sonuçları yanıltıcı biçimde kesin başarı vaadi gibi sunmamayı esas alırız.</p>

    <h2>Ödeme, iptal ve kişisel veri talepleri</h2>
    <p>Ödeme veya abonelikle ilgili başvurularınızda işlem yaptığınız hizmeti ve talebinizin türünü belirtmeniz yeterlidir; tam kart bilgisi göndermeniz gerekmez. İptal ve iade koşulları için İptal / İade sayfasını, kişisel veri işleme ve başvuru hakları için KVKK / Aydınlatma ve Gizlilik Politikası sayfalarını inceleyebilirsiniz. Bu metinlerde yer almayan veya hesabınıza özel bir konu varsa kayıtlı iletişim kanallarımız üzerinden destek talebi oluşturabilirsiniz.</p>

    <h2>Resmî iletişim</h2>
    <p>Hizmet, teklif, ödeme, iptal, kişisel veri başvurusu ve destek talepleriniz için yalnızca bu sayfada yayımlanan kayıtlı iletişim kanallarımızı kullanın. Böylece talebinizin doğru hizmet kaydıyla eşleştirilmesi ve gerektiğinde önceki yazışmalarla birlikte takip edilmesi daha kolay olur.</p>
  </PublicPage>;
}
