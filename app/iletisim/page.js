import PublicPage from "../../components/PublicPage";
export const metadata={title:"İletişim | AI Visibility"};
export default function Page(){
  const email=process.env.PUBLIC_CONTACT_EMAIL||"";
  const phone=process.env.PUBLIC_CONTACT_PHONE||"";
  return <PublicPage title="İletişim">
    <p><b>Hizmet adı:</b> AI Visibility</p>
    {email?<p><b>İletişim e-postası:</b> <a href={`mailto:${email}`}>{email}</a></p>:<p>Genel iletişim e-postası henüz yayınlanmadı. Bu sayfa üzerinden e-posta ile başvuru alındığı iddia edilmez.</p>}
    {phone?<p><b>İletişim telefonu:</b> {phone}</p>:null}
    <p>Hizmet kapsamı, teklif, ödeme ve destek koşulları hakkında doğrulanmış iletişim kanalları üzerinden bilgi verilir.</p>
    <p><small>Güvenlik amacıyla yönetici hesap kurtarma bilgileri kamuya açık iletişim bilgisi olarak kullanılmaz.</small></p>
  </PublicPage>;
}
