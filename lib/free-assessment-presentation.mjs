/** Explain the evidence gate for free assessment without inventing results. */
export function freeAssessmentPresentation(a){
 const samples=Number.isInteger(a?.samples)&&a.samples>=0?a.samples:null;
 const providers=Number.isInteger(a?.providers)&&a.providers>=0?a.providers:null;
 const queries=Number.isInteger(a?.queries)&&a.queries>=0?a.queries:null;
 const min=a?.minimum;
 const limits=Number.isInteger(min?.samples)&&min.samples>0&&Number.isInteger(min?.providers)&&min.providers>0&&Number.isInteger(min?.queries)&&min.queries>0?min:{samples:6,providers:2,queries:2};
 const valid=samples!==null&&providers!==null&&queries!==null;
 const ready=valid&&a?.status==='ready'&&Number.isInteger(a?.score)&&a.score>=0&&a.score<=100&&samples>=limits.samples&&providers>=limits.providers&&queries>=limits.queries;
 return {
  showScore:ready,
  evidenceState:ready?'eligible-sample':'insufficient-or-unverified',
  missing:valid?{samples:Math.max(0,limits.samples-samples),providers:Math.max(0,limits.providers-providers),queries:Math.max(0,limits.queries-queries)}:null,
  labels:{tr:ready?'Sınırlı kayıtlı API yanıt örneklemi':'Yeterli doğrulanmış örnek yok',en:ready?'Limited recorded API-answer sample':'Insufficient verified samples'}
 };
}
