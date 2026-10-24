import {AUDIT_TASKS} from './zera-audit-queue.mjs';

/** Evidence coverage, not a commercial or search ranking score. */
export function calculateAuditCoverage(report){
 const completed=Number(report?.progress?.completed||0);
 const total=AUDIT_TASKS.length;
 const verified=Array.isArray(report?.observations)?report.observations.length:0;
 if(!Number.isInteger(completed)||completed<0||completed>total||verified!==completed)
  throw new Error('Inconsistent verified audit evidence');
 return {type:'audit_evidence_coverage',value:Math.round(100*completed/total),verified,total,
  visibilityScore:null,reason:'Search visibility cannot be rated from audit completion alone'};
}
