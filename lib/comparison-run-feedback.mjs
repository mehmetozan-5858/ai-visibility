const noRetry='Otomatik tekrar yapılmayacak.';
export function comparisonRunFeedback(data={},httpOk=true){
 const rows=Array.isArray(data.results)?data.results.filter(x=>x&&typeof x==='object').slice(0,3):[];
 if(!httpOk)return data.providerCallsStarted===0
  ?'Kayıt hazırlığı başarısız; sağlayıcı çağrısı başlatılmadı. '+noRetry
  :'Tarama başlatılamadı veya tamamlanamadı; mevcut deneme kaydını kontrol edin. '+noRetry;
 const stored=rows.filter(x=>x.status==='stored').length;
 const failed=rows.some(x=>['provider-failed','error'].includes(x.status));
 if(stored)return `${stored} AI yanıtı kaydedildi. Sonuçları görmek için sayfayı yenileyin.`+(failed?' Bazı görevler başarısız oldu. '+noRetry:'');
 if(rows.some(x=>x.status==='provider-failed'))return 'Sağlayıcıdan kullanılabilir yanıt alınamadı; kayıt aşamasına geçilmedi. '+noRetry;
 if(rows.some(x=>x.status==='error'&&x.failureStage==='provider'))return 'Sağlayıcı yanıtı işlenemedi. '+noRetry;
 if(rows.some(x=>x.status==='error'))return 'Yanıt veya deneme kaydı tamamlanamadı; kayıt durumunu kontrol edin. '+noRetry;
 return 'Önceki deneme kaydını kontrol edin; yeni bir tamamlanmış ölçüm doğrulanmadı. '+noRetry;
}

export function comparisonHistoryFeedback(history={}){
 const attempts=Array.isArray(history.attempts)?history.attempts.filter(x=>x&&typeof x==='object').slice(0,3):[];
 if(!attempts.length)return '';
 if(attempts.some(x=>x.status==='provider-failed'))return 'Önceki görevlerden biri sağlayıcı aşamasında başarısız oldu. '+
  (attempts.some(x=>x.status==='provider-failed'&&!x.failureReason)?'Ayrıntılı hata nedeni mevcut durum yanıtında bulunmuyor. ':'')+noRetry;
 if(attempts.some(x=>x.status==='error'))return 'Önceki görevde işlem veya kayıt hatası oluştu; deneme kaydını kontrol edin. '+noRetry;
 if(attempts.every(x=>x.status==='stored'))return 'Önceki AI yanıtları kaydedildi; ölçümün kapsamını sonuçlar bölümünden kontrol edin.';
 return 'Önceki deneme kaydı mevcut; yeni çağrı başlatılmadı.';
}
