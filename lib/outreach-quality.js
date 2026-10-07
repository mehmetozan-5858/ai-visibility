const clean=(v,max=180)=>String(v||'').replace(/[\r\n]+/g,' ').trim().slice(0,max);
export function outreachApproach(x){
 const sector=clean(x.sector,240).toLocaleLowerCase('tr-TR');
 if(/e.?ticaret|e.?commerce|online shop|retail|mağaza|magaza|ürün markası|product brand/.test(sector))return 'product';
 if(/üret|uret|manufactur|casting|machining|cnc|industrial|endüstr|endustr|b2b|sanayi|ihrac|export|packaging|ambalaj/.test(sector))return 'buyer';
 if(/otel|hotel|restoran|restaurant|kafe|cafe|clinic|klinik|dent|diş|dis |sağlık|saglik|salon|beauty|güzellik|guzellik|turizm|tourism|konaklama/.test(sector))return 'local';
 return 'discovery';
}
export function outreachSubject(x,follow=false){
 const tr=/^(Türkiye|Turkey|TR)$/i.test(String(x.country||'')),name=clean(x.name),kind=outreachApproach(x);
 const titles=tr?{discovery:`Yeni müşteriler ${name} ile karşılaşıyor mu?`,buyer:`${name}: doğru alıcı uzmanlığınızı anlayabiliyor mu?`,local:`${name}: müşteri sizi neden seçsin?`,product:`${name}: ürünleriniz alıcının sorularını yanıtlıyor mu?`}:{discovery:`Can new customers discover ${name}?`,buyer:`Can the right buyer understand ${name}'s expertise?`,local:`Why would a customer choose ${name}?`,product:`${name}: do your products answer buyers' questions?`};
 return (follow?(tr?'Kısa bir hatırlatma: ':'A brief follow-up: '):'')+titles[kind];
}
export function permissionEnquiry(x,follow=false){
 const tr=/^(Türkiye|Turkey|TR)$/i.test(String(x.country||'')),name=clean(x.name),sector=clean(x.sector)|| (tr?'sektörünüz':'your industry'),location=[clean(x.city,100),clean(x.country,100)].filter(Boolean).join(', '),kind=outreachApproach(x);
 const openings=tr?{
 discovery:`Potansiyel bir müşteri yapay zekâya “${location?location+' bölgesinde ':''}${sector} için hangi işletmeleri önerirsiniz?” diye sorduğunda ${name} ile karşılaşıyor mu?`,
 buyer:`Bir alıcı ${sector} alanında tedarikçi aradığında, işletmenizin hangi ihtiyaca uygun olduğunu kolayca anlayabiliyor mu? Üretim kabiliyetiniz ve uzmanlığınız, sizi henüz tanımayan alıcı için yeterince açık mı?`,
 local:`${location?location+' bölgesinde ':''}${sector} arayan biri, sizi neden tercih etmesi gerektiğini ve sizinle nasıl iletişime geçeceğini kolayca anlayabiliyor mu?`,
 product:`${sector} alanında ürün arayan bir müşteri, ürünlerinizin özelliklerini, kullanım alanlarını ve satın alma koşullarını kolayca anlayabiliyor mu?`
 }:{
 discovery:`When a potential customer asks AI “Which businesses would you recommend for ${sector}${location?' in '+location:''}?”, do they encounter ${name}?`,
 buyer:`When a buyer searches for a supplier in ${sector}, can they readily understand which needs ${name} can meet? Are your capabilities and expertise clear to a buyer who has not met you?`,
 local:`When someone searches for ${sector}${location?' in '+location:''}, can they see why they should choose ${name} and how to contact you?`,
 product:`When a customer searches for products in ${sector}, can they understand ${name}'s product features, uses and purchasing terms?`
 };
 const benefits=tr?{
 discovery:'Amaç, potansiyel müşterilerin sizi bulmasını kolaylaştırmak için hangi bilgileri geliştirmeniz gerektiğini somutlaştırmak.',
 buyer:'Amaç, doğru alıcıya ne sunduğunuzu ve neden sizinle görüşmesi gerektiğini daha anlaşılır göstermek.',
 local:'Amaç, müşterinin tercih, randevu veya rezervasyon kararını kolaylaştıran bilgileri belirlemek.',
 product:'Amaç, satın alma kararında ihtiyaç duyulan ürün bilgilerini ve açıklığa kavuşturulabilecek noktaları belirlemek.'
 }:{
 discovery:'The aim is to identify which information could make it easier for relevant customers to discover your business.',
 buyer:'The aim is to help the right buyer understand your offering and why they should speak with you.',
 local:'The aim is to identify information that helps a customer choose, enquire, book or make an appointment.',
 product:'The aim is to identify product information buyers need to make an informed purchasing decision.'
 };
 return tr?`Merhaba ${name} ekibi,\n\n${follow?'Önceki mesajımıza kısa bir hatırlatma.\n\n':''}${openings[kind]}\n\nAI Visibility Works olarak sektörünüze özel soruların kayıtlı AI yanıtlarını ve işletme bilgilerinizi birlikte inceliyoruz. ${benefits[kind]}\n\nÜcretsiz ön değerlendirmede yeterli ölçüm varsa örnek yanıt eşleşme puanınızı ve kısa açıklamasını görebilirsiniz. Ayrıntılı analiz, yanıt kanıtları ve öneriler ücretli raporla; düzenli ölçüm ve değişim takibi aylık takip hizmetiyle açılır. Uygulama kapsamı ayrıca belirlenir.\n\nSize uygun kısa bir örnek paylaşmamızı ister misiniz?\n\nBu mesaj tamamlanmış bir analiz veya sonuç garantisi içermez. İlgilenmiyorsanız yanıtlayarak belirtmeniz yeterli; tekrar iletişim kurmayacağız.\n\nAI Visibility Works`:
 `Hello ${name} team,\n\n${follow?'A brief follow-up to our previous message.\n\n':''}${openings[kind]}\n\nAI Visibility Works reviews recorded AI answers to industry-specific questions alongside your business information. ${benefits[kind]}\n\nThe free assessment shows a sample-answer match score and a short explanation when sufficient evidence is available. Detailed analysis, answer evidence and recommendations are included in a paid report; regular measurements and change tracking require a monthly monitoring service. Implementation is scoped separately.\n\nWould you be interested in receiving a short example for your business?\n\nThis enquiry does not claim a completed audit or guaranteed results. If this is not relevant, reply to let us know and we will stop contacting you.\n\nAI Visibility Works`;
}
// Only the current sector-specific, reviewed message is accepted; edited claims are rejected.
export function safeFirstContact(x){
 const draft=String(x.outreachDraft||'').trim();
 return [permissionEnquiry(x),permissionEnquiry(x,true)].some(v=>v.trim()===draft);
}
