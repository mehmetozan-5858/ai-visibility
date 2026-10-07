import {repeatEvidenceOptions} from './answer-evidence-comparison.js';
export function implementationAnswerOptions(entity,baseline,work,{providers=[],now}={}){
 if(entity.entityType!=='client'||entity.status!=='active'||entity.paid!==true||!entity.domain||entity.domain.endsWith('.local')||work.clientId!==entity.id||work.status!=='completed'||String(work.completionEvidence||'').trim().length<20)throw Error('implementation-not-eligible');
 const completed=Date.parse(work.evidenceRecordedAt),time=Date.parse(now),created=Date.parse(baseline?.createdAt);
 if(!Number.isFinite(completed)||!Number.isFinite(time)||!Number.isFinite(created)||created>=completed||time<completed+86400000)throw Error('implementation-timing-required');
 const options=repeatEvidenceOptions(entity,baseline,providers),observations=baseline.result?.observations||[];
 if(options.queries.length!==1||options.providers.length!==1||observations.length!==1)throw Error('single-neutral-baseline-required');
 const observation=observations[0],checked=Date.parse(observation.checkedAt);
 if(observation.brandPrompted!==false||observation.truncated!==false||!observation.model||!observation.mode||!Number.isFinite(checked)||checked>=completed)throw Error('pre-implementation-answer-required');
 return {...options,automaticRepeat:true,automationKind:'repeat',implementationWorkId:work.id,implementationContext:{workId:work.id,title:work.title,baselineRunId:baseline.id,evidenceRecordedAt:work.evidenceRecordedAt,evidenceUrl:work.evidenceUrl||'',verification:'admin-attested',scope:'Görevin tamamlanma kaydı yönetici beyanına dayanır. Bu yanıt karşılaştırması, uygulamanın bağımsız doğrulaması veya değişimin sebebi değildir.'}};
}
