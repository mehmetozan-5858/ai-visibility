import PublicPage from "../../components/PublicPage";
export const metadata={alternates:{canonical:"/gizlilik"},title:"Gizlilik Politikası",description:"AI Visibility hizmetinde kişisel verilerin hangi amaçlarla işlendiğini, ödeme ve güvenlik yaklaşımını ve veri sorumlusu bilgilerine nasıl ulaşılacağını açıklayan gizlilik politikası."};
export default function Page(){
  const controller=(process.env.DATA_CONTROLLER_NAME||"").trim();
  return <PublicPage title="Gizlilik Politikası">
    <p><b>AI Visibility</b>, hizmetin müşteri-facing markasıdır. {controller?<>Kişisel verilerin veri sorumlusu <b>{controller}</b>'dir.</>:<>Yasal veri sorumlusu kimliği <a href="/kvkk">KVKK Aydınlatma Metni</a> ve <a href="/iletisim">İletişim</a> sayfasında yayımlanır.</>} Veri sorumlusu ve başvuru kanalları için <a href="/kvkk">KVKK Aydınlatma Metni</a> ile <a href="/iletisim">İletişim</a> sayfasını inceleyebilirsiniz.</p>
    <p>Hizmetin sunulması için gerekli olan iletişim, müşteri, tarama, raporlama ve ödeme durum bilgileri yalnızca hizmetin kurulması, yürütülmesi, güvenliğinin sağlanması ve yasal yükümlülüklerin yerine getirilmesi amaçlarıyla işlenir.</p>
    <p>Kart bilgileri AI Visibility sunucularında tutulmaz; kartlı ödeme kullanıldığında ödeme sağlayıcısının güvenli ödeme ekranı kullanılır. Erişim anahtarları ve şifreler kaynak kodda açık olarak saklanmaz.</p>
    <p>Veriler, hizmetin yürütülmesi, güvenlik ve yasal yükümlülükler dışında üçüncü kişilerle paylaşılmaz; zorunlu teknik ve ödeme hizmet sağlayıcıları yalnızca gerekli kapsamda kullanılabilir.</p>
    <p>Bu gizlilik politikası, hizmet kapsamı veya yasal yükümlülükler değiştikçe güncellenebilir.</p>
  </PublicPage>;
}