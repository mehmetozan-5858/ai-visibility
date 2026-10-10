import {Shell} from "../../components/ui";
import ClientsManager from "../../components/ClientsManager";
import ProspectsManager from "../../components/ProspectsManager";

export default function Page(){
  return <Shell title="Müşteriler" subtitle="Adaydan aktif müşteriye uzanan ilişki akışını tek çalışma alanında yönetin.">
    <div className="admin-workspace clients-workspace">
      <section className="admin-workspace-intro">
        <article>
          <span className="admin-page-kicker">CLIENT OPERATIONS</span>
          <h2>Aday → değerlendirme → müşteri</h2>
          <p>Aday işletmeleri, doğrulanmış iletişim ve uygunluk verileriyle inceleyin; yalnızca değerlendirmesi tamamlanan kayıtları müşteri sürecine taşıyın.</p>
          <div className="admin-workspace-chips"><span>Aday havuzu</span><span>Uygunluk kontrolü</span><span>Müşteri kaydı</span><span>Süreç takibi</span></div>
        </article>
        <article>
          <span className="admin-page-kicker">VERİ DİSİPLİNİ</span>
          <h2>Tek kayıt, tek gerçek</h2>
          <p>Aday ve müşteri bilgilerini aynı operasyon zincirinde tutun. Karar verirken güncel kayıtları ve doğrulanmış kaynakları esas alın.</p>
        </article>
      </section>
      <ProspectsManager/>
      <ClientsManager/>
    </div>
  </Shell>;
}