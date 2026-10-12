import PublicPage from "../../components/PublicPage";
export const metadata={title:"KVKK Aydınlatma Metni"};
export default function Page(){
  const controller=process.env.DATA_CONTROLLER_NAME||"AI Visibility";
  const contact=process.env.ADMIN_RECOVERY_EMAIL||"";
  return <PublicPage title="KVKK / Aydınlatma Metni">
    <p><b>Veri sorumlusu:</b> {controller}.{contact?<> İlgili kişi başvuruları için iletişim: {contact}.</>:null}</p>

    <h2>İşlenen veri kategorileri ve amaçlar</h2>
    <p>Ad-soyad, e-posta ve telefon gibi iletişim bilgileri; işletme ve alan adı bilgileri; hizmet talepleri; tarama, rapor, destek ve işlem kayıtları; ödeme ve fatura durum bilgileri hizmetin kurulması ve yürütülmesi, hesabın ve ödeme sürecinin yönetilmesi, destek sağlanması, güvenliğin temini, hizmet kalitesinin ölçülmesi ve hukuki yükümlülüklerin yerine getirilmesi amaçlarıyla işlenebilir.</p>

    <h2>Hukuki sebepler</h2>
    <p>Kişisel veriler, somut işleme faaliyetine göre 6698 sayılı Kanunun 5 ve gerekli olduğu ölçüde 6 ncı maddelerinde yer alan; bir sözleşmenin kurulması veya ifasıyla doğrudan ilgili olma, veri sorumlusunun hukuki yükümlülüğünü yerine getirebilmesi, bir hakkın tesisi, kullanılması veya korunması ve ilgili kişinin temel hak ve özgürlüklerine zarar vermemek kaydıyla meşru menfaat şartlarına dayanılarak işlenebilir. Kanunen açık rıza gerektiren ayrı bir faaliyet bulunursa açık rıza ayrıca alınır.</p>

    <h2>Toplama yöntemi</h2>
    <p>Veriler; internet sitesi ve müşteri ekranlarında doldurulan formlar, e-posta ve destek yazışmaları, ödeme bildirimleri, hizmetin yürütülmesi sırasında oluşan sistem ve güvenlik kayıtları ile müşterinin sağladığı veya izin verdiği dijital kaynaklar üzerinden tamamen veya kısmen otomatik yollarla ya da bir veri kayıt sisteminin parçası olmak kaydıyla otomatik olmayan yöntemlerle elde edilebilir.</p>

    <h2>Aktarım ve alıcı grupları</h2>
    <p>Veriler, yalnızca gerekli kapsamla sınırlı olmak üzere barındırma/veritabanı, e-posta, ödeme, güvenlik ve hizmetin teknik olarak sunulmasına yardımcı olan tedarikçilere; hukuki yükümlülük bulunması halinde yetkili kamu kurum ve kuruluşlarına ve uyuşmazlıkların yürütülmesi için yetkili danışman veya mercilere amaçla sınırlı şekilde aktarılabilir. Kart bilgileri AI Visibility sunucularında saklanmaz; kartlı ödeme kullanıldığında ödeme sağlayıcısının güvenli ödeme altyapısı kullanılır.</p>

    <h2>İlgili kişinin hakları</h2>
    <p>6698 sayılı Kanunun 11 inci maddesi kapsamındaki şartlarla; kişisel verilerinizin işlenip işlenmediğini öğrenme, işlenmişse bilgi talep etme, işleme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme, yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme, eksik veya yanlış işlenmişse düzeltilmesini isteme, kanuni şartları oluştuğunda silinmesini veya yok edilmesini isteme ve mevzuatta tanınan diğer haklarınızı kullanabilirsiniz.</p>

    <h2>Başvuru</h2>
    <p>{contact?<>Başvurularınızı {contact} adresine, kimliğinizi ve talebinizi doğrulamaya elverişli bilgilerle iletebilirsiniz.</>:<>Başvuru kanalı İletişim sayfasında yayımlanır. Ticari yayına geçmeden önce veri sorumlusunun açık kimliği ve başvuru iletişim kanalı yapılandırılmalıdır.</>}</p>
  </PublicPage>;
}