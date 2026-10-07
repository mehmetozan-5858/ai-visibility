'use client';
import {useEffect,useState} from 'react';
export default function FreeAssessment(){
 const [data,setData]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{
  const controller=new AbortController();
  const token=new URLSearchParams(window.location.hash.slice(1)).get('token');
  if(!token){setError('E-postanızdaki ücretsiz ön değerlendirme bağlantısını açın. / Open the free assessment link in your email.');setLoading(false);return ()=>controller.abort()}
  fetch('/api/free-assessment',{headers:{'x-preview-token':token},cache:'no-store',signal:controller.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Ön değerlendirme alınamadı.');setData(d)}).catch(e=>{if(e.name!=='AbortError')setError(e.message)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});
  return ()=>controller.abort();
 },[]);
 const tr=data?.language!=='en',a=data?.assessment;
 return <main style={{maxWidth:820,margin:'0 auto',padding:'32px 20px 100px',overflowWrap:'anywhere'}}>
  <a href="/">AI Visibility Works</a><h1>{tr?'Ücretsiz ön değerlendirme':'Your free assessment'}</h1>
  {loading?<p role="status">Ön değerlendirme yükleniyor… / Loading your assessment…</p>:null}
  {error?<section className="panel" role="alert"><p>{error}</p><a href="/iletisim">İletişim / Contact</a></section>:null}
  {data?<><section className="panel"><h2>{data.business.name}</h2><p>{[data.business.city,data.business.country,data.business.sector].filter(Boolean).join(' · ')}</p>
   <h3>{tr?'Örnek yanıt eşleşme puanı':'Sample-answer match score'}</h3>
   {a.status==='ready'?<><p style={{fontSize:48,fontWeight:800,margin:'16px 0'}}>{a.score}/100</p><p>{tr?'Puan, uygun kayıtlı yanıtların yüzde kaçında tam marka adı veya alan adı eşleşmesi bulunduğunu gösterir.':'The score shows the percentage of eligible recorded answers with an exact business-name or domain match.'}</p></>:<><p style={{fontSize:28,fontWeight:700}}>{tr?'Yeterli veri yok':'Insufficient evidence'}</p><p>{tr?'Puan için son 14 günde en az 6 farklı yanıt örneği, 2 sağlayıcı ve 2 farklı markasız sorgu gerekir. Eksik ölçüm sıfır puan olarak gösterilmez.':'A score requires at least 6 distinct answer samples, 2 providers and 2 different unbranded questions within the last 14 days. Missing evidence is not shown as a zero score.'}</p></>}
   <p>{a.samples} {tr?'yanıt örneği':'answer samples'} · {a.providers} {tr?'sağlayıcı':'providers'} · {a.queries} {tr?'sorgu':'questions'}</p>
   {a.measuredAt?<p>{tr?'Son uygun örnek':'Latest eligible sample'}: {new Date(a.measuredAt).toLocaleString(tr?'tr-TR':'en-GB',{timeZone:'UTC'})} UTC</p>:null}
   <small>{tr?'Bu sınırlı API yanıt örneklemi genel AI görünürlüğü, tüketici uygulamalarındaki sıralama veya satış olasılığı ölçümü değildir. Modelin kaynak içeriği ayrıca doğrulanmış sayılmaz.':'This limited API-answer sample is not a measure of general AI visibility, consumer-app ranking or likelihood of sales. Referenced source content is not independently verified.'}</small>
  </section>
  <section className="panel" style={{marginTop:24}}><h2>{tr?'Ayrıntılı rapor ve takip':'Detailed reporting and monitoring'}</h2><p>{tr?'Ham yanıtlar, ayrıntılı bulgular ve öneriler ücretsiz ekranda yer almaz. Rapor erişimi ödeme doğrulandıktan sonra müşteri panelinden sağlanır. Düzenli ölçüm ve değişim takibi aylık hizmettir; uygulama kapsamı ayrıca belirlenir.':'Raw answers, detailed findings and recommendations are not included in this free screen. Report access is provided through the customer portal after payment verification. Regular measurement and change tracking are a monthly service; implementation is scoped separately.'}</p>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,260px),1fr))',gap:16}}>{data.plans.map(p=><article key={p.code} style={{padding:20,border:'1px solid #214454',borderRadius:16}}><h3>{p.name}</h3><p><strong>{new Intl.NumberFormat(tr?'tr-TR':'en-GB',{style:'currency',currency:p.currency,maximumFractionDigits:0}).format(p.amount)}</strong>{p.kind==='monthly'?(tr?' / ay':' / month'):(tr?' · tek sefer':' · one time')}</p><a href={p.href}>{tr?'Hizmet başvurusu yap':'Apply for this service'} →</a></article>)}</div>
   <p><small>{tr?'Başvuru → kapsam onayı → güvenli ödeme → ödeme doğrulaması → müşteri paneli. Ödeme ücretsiz puanı değiştirmez; ölçüm sonucu veya iyileşme garantisi verilmez.':'Application → scope confirmation → secure payment → payment verification → customer portal. Payment does not change the free score; no measurement outcome or improvement is guaranteed.'}</small></p>
  </section></>:null}
 </main>;
}
