import {repeatEvidenceOptions} from './answer-evidence-comparison.js';
export const implementationWaitLabels={
 'inactive':'Müşteri aktif değil. Müşteri durumunu inceleyin.',
 'unpaid':'Doğrulanmış gerçek ödeme yok. Ödeme kaydını kontrol edin.',
 'domain':'Gerçek işletme alan adı eksik veya test kaydı; takip kapsamı dışında.',
 'access':'İş için erişim bekleniyor. Bekleyen İşler ekranında engeli giderin.',
 'approval':'İş için müşteri onayı bekleniyor. Bekleyen İşler ekranını kontrol edin.',
 'unfinished':'İş henüz kanıtla tamamlanmış değil. Uygulamayı ve tamamlanma kaydını kontrol edin.',
 'evidence':'Tamamlanma açıklaması veya kayıt tarihi eksik. Geçmiş tarihli ölçüm üretmeyin.',
 'baseline':'Uygulamadan önce alınmış uygun tek sorgu / tek sağlayıcı yanıtı yok. Tamamlanmış iş için geçmiş ölçüm oluşturulamaz.',
 'prepare-baseline':'Henüz uygun başlangıç yanıtı yok. Uygulama yapılmadan önce tek sorgu / tek sağlayıcı seçeneğiyle örnek alın.',
 'identity':'Başlangıç kaydının müşteri adı veya alan adı farklı; eski kayıt bu kimlikle eşleştirilemez.',
 'provider':'Başlangıç yanıtının sağlayıcısı şu anda bağlı değil. Yapılandırmayı kontrol edin.',
 'delay':'Tamamlanma kaydından sonra 24 saat bekleniyor.',
 'cooldown':'Son müşteri ölçümü veya otomatik denemeden sonra 24 saat bekleniyor.',
 'unknown':'Tarih veya durum doğrulanamadı; uygunluk bilinmiyor.'
};
export function implementationReadiness(row,providers,now){
 const entry={workId:row.workId,entityId:row.id,entityName:row.name,title:row.title,workStatus:row.workStatus,reasons:[],state:'blocked',nextEligibleAt:null,baselineRunId:row.baseline?.id||null};
 if(row.followupId){entry.state=row.followupComplete?'recorded':'review';entry.followupId=row.followupId;return entry}
 const add=code=>entry.reasons.push(code),time=Date.parse(now),completed=Date.parse(row.evidenceRecordedAt);
 if(row.status!=='active')add('inactive');if(row.paid!==true)add('unpaid');
 if(!row.domain||/\.local\/?$/i.test(row.domain))add('domain');
 if(row.workStatus==='access-required')add('access');else if(row.workStatus==='approval-required')add('approval');else if(row.workStatus!=='completed')add('unfinished');
 if(!Number.isFinite(time))add('unknown');
 if(row.workStatus==='completed'&&(String(row.completionEvidence||'').trim().length<20||!Number.isFinite(completed)))add('evidence');
 let valid=false;const baseline=row.baseline;
 if(baseline){
  const entity={id:row.id,name:row.name,domain:row.domain,entityType:'client'};
  try{const options=repeatEvidenceOptions(entity,baseline,providers),obs=baseline.result?.observations||[],x=obs[0];
   valid=options.queries.length===1&&options.providers.length===1&&obs.length===1&&!(baseline.result.errors||[]).length&&x.brandPrompted===false&&x.truncated===false&&x.model&&x.mode&&Number.isFinite(Date.parse(x.checkedAt));
   if(row.workStatus==='completed')valid=valid&&Number.isFinite(completed)&&Date.parse(x.checkedAt)<completed&&Date.parse(baseline.createdAt)<completed;
  }catch(e){add(e.message==='repeat-identity-mismatch'?'identity':'provider')}
 }
 if(!valid)add(row.workStatus==='completed'?'baseline':'prepare-baseline');
 const dates=[];if(row.workStatus==='completed'&&Number.isFinite(completed)){dates.push(completed+86400000);if(time<completed+86400000)add('delay')}
 if(row.lastAttemptAt){const last=Date.parse(row.lastAttemptAt);if(!Number.isFinite(last))add('unknown');else{dates.push(last+86400000);if(time<last+86400000)add('cooldown')}}
 if(dates.length&&Number.isFinite(time))entry.nextEligibleAt=new Date(Math.max(...dates)).toISOString();
 entry.state=!entry.reasons.length?'ready':entry.reasons.every(x=>['delay','cooldown'].includes(x))?'waiting':'blocked';return entry;
}
export function summarizeImplementationReadiness(rows,providers,now){
 const all=rows.slice(0,100).map(x=>implementationReadiness(x,providers,now)),counts={ready:0,waiting:0,blocked:0,recorded:0,review:0},reasons={};
 for(const x of all){counts[x.state]++;for(const code of x.reasons)reasons[code]=(reasons[code]||0)+1}
 return {counts,reasons,reviewed:all.length,limited:rows.length>100,entries:all.slice(0,20),scope:'İş kaydı bulunan ilk 100 görev değerlendirilir; ayrıntılar ilk 20 görevle sınırlıdır. Uygunluk, çalışma veya başarı garantisi değildir.'};
}
