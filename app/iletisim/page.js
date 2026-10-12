import PublicPage from "../../components/PublicPage";
export const metadata={title:"İletişim"};
export default function Page(){
  const controller=process.env.DATA_CONTROLLER_NAME||"AI Visibility";
  const email=process.env.ADMIN_RECOVERY_EMAIL||"";
  const phone=process.env.ADMIN_RECOVERY_PHONE||"";
  return <PublicPage title="İletişim">
    <p><b>Hizmet adı:</b> AI Visibility</p>
    <p><b>Hizmet sağlayıcı / veri sorumlusu:</b> {controller}</p>
    {email?<p><b>E-posta:</b> {email}</p>:<p>İletişim e-postası yapılandırılıyor.</p>}
    {phone?<p><b>Telefon:</b> {phone}</p>:null}
    <p>Hizmet, teklif, ödeme, iptal, kişisel veri başvurusu ve destek talepleriniz için e-posta veya telefon üzerinden iletişime geçebilirsiniz.</p>
  </PublicPage>
}