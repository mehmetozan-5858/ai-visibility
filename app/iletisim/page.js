import PublicPage from "../../components/PublicPage";
export const metadata={title:"İletişim | AI Visibility"};
export default function Page(){
  const email=process.env.ADMIN_RECOVERY_EMAIL||"";
  return <PublicPage title="İletişim">
    <p><b>Hizmet adı:</b> AI Visibility</p>
    {email?<p><b>E-posta:</b> {email}</p>:<p>İletişim e-postası yapılandırılıyor.</p>}
    <p>Hizmet, teklif, ödeme, iptal ve destek talepleriniz için e-posta üzerinden iletişime geçebilirsiniz.</p>
  </PublicPage>
}