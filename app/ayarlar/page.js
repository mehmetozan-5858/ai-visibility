import {Shell} from "../../components/ui";
import SettingsManager from "../../components/SettingsManager";
import TestCenter from "../../components/TestCenter";

export default function Page(){
  return <Shell title="Ayarlar" subtitle="Bağlantıları, güvenlik kontrollerini, otomasyon tercihlerini ve test durumunu tek yerde yönetin.">
    <div className="admin-workspace settings-workspace">
      <section className="admin-workspace-intro">
        <article>
          <span className="admin-page-kicker">SYSTEM CONTROL</span>
          <h2>Bağlantı, güvenlik ve otomasyon tek merkezde</h2>
          <p>Çalışan bağlantıları ve operasyon tercihlerini değiştirirken hangi ayarın neyi etkilediğini net biçimde görün. Kritik değişiklikleri test etmeden canlı akışa taşımayın.</p>
          <div className="admin-workspace-chips"><span>Bağlantılar</span><span>Güvenlik</span><span>Otomasyon</span><span>Test merkezi</span></div>
        </article>
        <article>
          <span className="admin-page-kicker">CHANGE SAFETY</span>
          <h2>Değiştir → test et → doğrula</h2>
          <p>Ayarları operasyonel risk yaratmadan yönetin; test merkezi sonuçlarını kontrol ederek doğrulanmış yapılandırmaları kullanın.</p>
        </article>
      </section>
      <SettingsManager/>
      <TestCenter/>
    </div>
  </Shell>;
}