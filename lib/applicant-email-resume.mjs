// A lead reference is not an authentication credential or an access grant.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function applicantEmailResumeHref(id){
 return typeof id==='string'&&uuid.test(id)?'/basvuru-dogrula#lead='+id.toLowerCase():null;
}
export function applicantEmailResumeId(hash,state){
 if(typeof hash!=='string')return null;
 if(hash){
  const params=new URLSearchParams(hash.replace(/^#/,''));
  const id=params.get('lead');
  return params.size===1&&uuid.test(id||'')?id.toLowerCase():null;
 }
 const id=state?.aivApplicantLead;
 return typeof id==='string'&&uuid.test(id)?id.toLowerCase():null;
}
