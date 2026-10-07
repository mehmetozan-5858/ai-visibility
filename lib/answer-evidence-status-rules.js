import {sameEvidenceIdentity,repeatEvidenceOptions} from './answer-evidence-comparison.js';
export const evidenceWaitLabels={ready:'Yeniden ölçüme uygun',cooldown:'24 saatlik aralık bekleniyor',identity:'İşletme adı veya alan adı değişmiş',provider:'Önceki sağlayıcı bağlı değil',baseline:'Uygun tamamlanmış markasız yanıt gerekli',inactive:'Aday otomatik ölçüm kapsamından çıkmış',unknown:'Son ölçüm zamanı doğrulanamadı'};
export function automaticRepeatState(entity,run,{providers=[],lastAttemptAt,now}={}){
 const state=reason=>({state:reason,label:evidenceWaitLabels[reason],nextEligibleAt:null});
 if(entity.clientId||['lost','won'].includes(entity.crmStage))return state('inactive');
 if(!run)return state('baseline');
 if(!sameEvidenceIdentity({...entity,entityType:'prospect'},run)||String(entity.domain||'').trim().toLowerCase()!==String(run.domain||'').trim().toLowerCase())return state('identity');
 let options;try{options=repeatEvidenceOptions({...entity,entityType:'prospect'},run,providers)}catch{return state('provider')}
 const observations=run.result?.observations||[];
 if(options.queries.length!==1||options.providers.length!==1||observations.length!==1||!observations.some(x=>x.brandPrompted===false&&x.truncated===false&&x.model&&x.mode))return state('baseline');
 const last=Date.parse(lastAttemptAt),time=Date.parse(now);if(!Number.isFinite(last)||!Number.isFinite(time))return state('unknown');
 const next=last+86400000;return {state:time>=next?'ready':'cooldown',label:evidenceWaitLabels[time>=next?'ready':'cooldown'],nextEligibleAt:new Date(next).toISOString()};
}
export function summarizeEvidenceStatus(rows,providers,now){
 const entries=rows.map(row=>({...automaticRepeatState(row.entity,row.run,{providers,lastAttemptAt:row.lastAttemptAt,now}),entityId:row.entity.id,entityName:row.entity.name,lastAttemptAt:row.lastAttemptAt||null,baselineRunId:row.run?.id||null}));
 const counts={ready:0,cooldown:0,blocked:0},reasons={};for(const x of entries){if(x.state==='ready')counts.ready++;else if(x.state==='cooldown')counts.cooldown++;else{counts.blocked++;reasons[x.state]=(reasons[x.state]||0)+1}}
 entries.sort((a,b)=>{const rank=x=>x.state==='ready'?0:x.state==='cooldown'?1:2;return rank(a)-rank(b)||(Date.parse(a.nextEligibleAt)||Infinity)-(Date.parse(b.nextEligibleAt)||Infinity)||String(a.entityId).localeCompare(String(b.entityId))});
 return {counts,reasons,entries:entries.slice(0,10),reviewed:rows.length};
}
