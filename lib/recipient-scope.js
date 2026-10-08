// Negative scope checks only: passing this check is not proof of the recipient's role.
const fold=v=>String(v||'').toLowerCase().replace(/ı/g,'i').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const countries=[['turkiye','turkey','tr'],['germany','deutschland','almanya'],['france','fransa'],['netherlands','holland','hollanda'],['united kingdom','uk','britain','england'],['united states','usa','us'],['colombia','kolombiya'],['chile'],['canada','kanada'],['australia','avustralya'],['italy','italia','italya'],['spain','espana','ispanya'],['singapore','singapur'],['japan','japonya'],['saudi arabia','saudi','suudi arabistan'],['united arab emirates','uae'],['mexico','meksika'],['ecuador'],['peru'],['costa rica','costarica'],['paraguay'],['brazil','brasil','brezilya']];
const cities=['ankara','istanbul','izmir','bursa','antalya','sivas','berlin','munich','munchen','amsterdam','paris','london','miami','riyadh','dubai','sydney','toronto','madrid','milan','milano','bogota'];
const tokens=v=>fold(v).split(/[^a-z0-9]+/).filter(Boolean);
export function recipientScopeIssue(x={}){
 if(x.sourceReview?.method==='manual-source-review-v2'&&x.sourceReview.assessment?.decision==='needs-review')return 'source-review-needs-review';
 const local=tokens(String(x.contactEmail||'').split('@')[0]),target=fold(x.country).trim();
 const country=countries.findIndex(group=>group.includes(target));
 for(let i=0;i<countries.length;i++)if(i!==country&&countries[i].some(alias=>alias.length>3&&!alias.includes(' ')&&local.includes(alias)))return 'contact-country-mismatch';
 const city=fold(x.city).trim();
 if(city&&cities.some(value=>local.includes(value)&&value!==city&&!(['munich','munchen'].includes(value)&&['munich','munchen'].includes(city))&&!(['milan','milano'].includes(value)&&['milan','milano'].includes(city))))return 'contact-city-mismatch';
 try{
  const path=tokens(new URL(x.contactSourceUrl).pathname);
  if(/(?:head-office-locations|global-offices|worldwide-offices|international-contact-list)/i.test(new URL(x.contactSourceUrl).pathname))return 'contact-branch-review-required';
  for(let i=0;i<countries.length;i++)if(i!==country&&countries[i].some(alias=>alias.length>3&&!alias.includes(' ')&&path.includes(alias)))return 'contact-country-mismatch';
 }catch{} // URL/domain and live-page verification remain separate mandatory checks.
 return '';
}
