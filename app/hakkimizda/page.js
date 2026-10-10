import Link from "next/link";
import PublicPage from "../../components/PublicPage";
export const metadata={title:"Hakkımızda | AI Visibility",description:"AI Visibility'in ürün yaklaşımı, çalışma prensipleri ve dijital görünürlük metodolojisi."};
const principles=[
 ["Kanıt önce","Önemli bulguların kaynak, ölçüm bağlamı ve güven düzeyiyle birlikte sunulmasını hedefleriz."],
 ["Aksiyon odaklı","Yalnızca skor göstermek yerine, uygulanabilir ve önceliklendirilmiş sonraki adımları öne çıkarırız."],
 ["Şeffaflık","Demo veriyi gerçek müşteri verisi gibi sunmayız; doğrulanmamış özellikleri aktifmiş gibi göstermeyiz."],
 ["Kontrollü uygulama","Müşteri onayı ve gerekli erişimler olmadan üçüncü taraf sistemlerde değişiklik yapılmaz."]
];
export default function Page(){return <PublicPage title="AI görünürlüğünü ölçmekten fazlasını yapıyoruz" subtitle="AI Visibility; markaların yapay zekâ arama ve yanıt sistemlerindeki görünürlüğünü anlamasını, kanıtlamasını ve geliştirmesini kolaylaştırmak için tasarlanmış bir dijital görünürlük platformudur.">
  <section className="public-story-grid">
    <div><span className="public-kicker">NEDEN VARIZ</span><h2>Yeni arama davranışında görünürlük artık yalnızca klasik SEO değildir.</h2><p>İnsanlar ürün, hizmet ve şirket araştırırken ChatGPT, Gemini, Perplexity ve diğer yapay zekâ destekli deneyimlerden giderek daha fazla yararlanıyor. AI Visibility, işletmelerin bu yeni görünürlük katmanını daha anlaşılır ve yönetilebilir hale getirmesine yardımcı olmak için geliştiriliyor.</p></div>
    <div className="public-story-card"><b>Ürün yaklaşımımız</b><p>Keşfet → Kanıtla → Önceliklendir → İyileştir → Yeniden ölç.</p><small>Bu akış, tek bir skor yerine karar vermeyi kolaylaştıran çalışma disiplini sağlar.</small></div>
  </section>
  <section className="public-principles"><span className="public-kicker">ÇALIŞMA PRENSİPLERİ</span><h2>Güven, görünümden önce gelir.</h2><div className="public-principle-grid">{principles.map(([title,text],i)=><article key={title}><span>0{i+1}</span><h3>{title}</h3><p>{text}</p></article>)}</div></section>
  <section className="public-cta-band"><div><span className="public-kicker">SIRADAKİ ADIM</span><h2>İşletmeniz için uygun hizmet kapsamını inceleyin.</h2><p>Ülkeye göre fiyatlandırma, hizmet kapsamı ve yasal koşullar satın alma öncesinde açık şekilde gösterilir.</p></div><div><Link className="public-primary-link" href="/hizmetler">Hizmetler ve fiyatlar →</Link><Link className="public-secondary-link" href="/iletisim">İletişim →</Link></div></section>
</PublicPage>}
