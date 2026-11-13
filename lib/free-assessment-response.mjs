/** Validate only the envelope consumed by the public assessment UI.
 * This is a display-safety check, not proof that measurements or payment are real.
 */
export function validFreeAssessmentResponse(d){
 if(!d||typeof d!=='object'||Array.isArray(d))return false;
 if(!d.business||typeof d.business!=='object'||typeof d.business.name!=='string'||!d.business.name.trim())return false;
 const a=d.assessment;
 if(!a||typeof a!=='object'||!['ready','insufficient'].includes(a.status))return false;
 if(!Number.isInteger(a.samples)||a.samples<0||!Number.isInteger(a.providers)||a.providers<0||!Number.isInteger(a.queries)||a.queries<0)return false;
 if(a.score!==null&&(!Number.isInteger(a.score)||a.score<0||a.score>100))return false;
 if(!Array.isArray(d.plans)||d.plans.length>10)return false;
 return d.plans.every(p=>p&&typeof p.code==='string'&&typeof p.name==='string'&&
  Number.isFinite(p.amount)&&p.amount>=0&&typeof p.currency==='string'&&/^[A-Z]{3}$/.test(p.currency)&&
  ['monthly','one-time'].includes(p.kind)&&typeof p.href==='string'&&p.href.startsWith('/yeni-musteri?'));
}
