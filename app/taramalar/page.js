import {Shell} from "../../components/ui";
import ScanManager from "../../components/ScanManager";

export default function Page(){
  return <Shell title="Taramalar" subtitle="Ölçüm geçmişini, sağlayıcı ön değerlendirmelerini ve kanıt bağlamını aynı ekranda inceleyin.">
    <div className="admin-workspace scans-workspace">
      <section className="admin-workspace-intro">
        <article>
          <span className="admin-page-kicker">MEASUREMENT CONTROL</span>
          <h2>Tarama sonucu kadar bağlamı da görün</h2>
          <p>Her ölçümü tarih, sağlayıcı, kaynak ve durum bilgisiyle birlikte değerlendirin. Tek bir skor yerine değişimin hangi kanıttan geldiğini takip edin.</p>
          <div className="admin-workspace-chips"><span>Tarama geçmişi</span><span>Sağlayıcı görünümü</span><span>Kanıt bağlamı</span><span>Değişim takibi</span></div>
        </article>
        <article>
          <span className="admin-page-kicker">ÖLÇÜM PRENSİBİ</span>
          <h2>Önce doğrula, sonra yorumla</h2>
          <p>Ön değerlendirmeler nihai sonuç değildir. Yönetim kararlarında doğrulanmış ölçüm, tarih ve kaynak bağlantılarını esas alın.</p>
        </article>
      </section>
      <ScanManager/>
    </div>
  </Shell>;
}