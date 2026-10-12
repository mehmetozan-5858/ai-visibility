import PublicPage from "../../components/PublicPage";
export const metadata={title:"İletişim"};
export default function Page(){
  const controller=(process.env.DATA_CONTROLLER_NAME||"").trim();
  const email=process.env.ADMIN_RECOVERY_EMAIL||"";
  const phone=process.env.ADMIN_RECOVERY_PHONE||"";
  return <PublicPage title="İletişim">
    <p><b>Hizmet markası:</b> AI Visibility</p>
    <p><b>Platform:</b> AI Visibility Intelligence Platform</p>
    {controller
      ? <p><b>Yasal hizmet sağlayıcı / veri sorumlusu:</b> {controller}</p>
      : <p><b>Yasal hizmet sağlayıcı / veri sorumlusu:</b> Ticari yayına geçmeden önce gerçek kişi veya kayıtlı işletme niteliğindeki yasal kimlik burada ayrıca yayımlanacaktır.</p>}
    {email?<p><b>E-posta:</b> {email}</p>:<p>İletişim e-postası yapılandırılıyor.</p>}
    {phone?<p><b>Telefon:</b> {phone}</p>:null}
    <p>Hizmet, teklif, ödeme, iptal, kişisel veri başvurusu ve destek talepleriniz için kayıtlı iletişim kanallarımız üzerinden bize ulaşabilirsiniz.</p>
  </PublicPage>
}