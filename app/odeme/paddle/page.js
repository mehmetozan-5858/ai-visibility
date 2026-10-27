import PaddlePaymentLink from '../../../components/PaddlePaymentLink';
import {paddleLiveReadiness} from '../../../lib/paddle-readiness';

export const metadata={title:'Güvenli Paddle Ödemesi',robots:{index:false,follow:false,nocache:true},referrer:'no-referrer'};

export default async function Page({searchParams}){
 const query=await searchParams;
 // The live SDK remains closed on preview and until the existing merchant,
 // domain and credential readiness gates are explicitly configured.
 const ready=paddleLiveReadiness({service:'business-diagnosis',origin:'https://www.aivisibilityworks.com'}).ready;
 return <main style={{maxWidth:720,margin:'48px auto',padding:'0 20px'}}>
  <h1>Güvenli ödeme</h1>
  <p>Kart bilgileriniz Paddle’ın güvenli ödeme ekranında işlenir. Hesap erişimi, ödeme bildirimi doğrulandıktan sonra güncellenir.</p>
  <PaddlePaymentLink ready={ready} transactionId={query?._ptxn}/>
  <p><a href="/musteri-giris">Müşteri girişi</a> · <a href="/iletisim">Destek</a> · <a href="/iptal-iade">İptal / İade</a></p>
 </main>;
}
