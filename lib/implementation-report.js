import {answerEvidenceStatus} from './answer-evidence-status';
export async function implementationReport(deps={}){
 const status=await (deps.status||answerEvidenceStatus)({entityType:'client'}),r=status.readiness;
 if(!r?.counts||!Number.isFinite(Date.parse(status.serverNow)))throw Error('implementation-report-unavailable');
 const priority={review:0,blocked:1,waiting:2,ready:3,recorded:4};
 return {available:true,snapshotType:'current',asOf:status.serverNow,counts:r.counts,reasons:r.reasons,reviewed:r.reviewed,limited:r.limited,hourlyUsed:status.hourlyUsed,scope:r.scope,entries:r.entries.filter(x=>x.state!=='recorded').sort((a,b)=>priority[a.state]-priority[b.state]).slice(0,5)};
}
