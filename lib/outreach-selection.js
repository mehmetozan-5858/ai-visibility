// Comparative priority, not a conversion probability or a verified revenue forecast.
function officialSpecialty(x){
 const match=String(x.source||'').match(/^specialist-evidence: (.{30,}) \| (https:\/\/\S+)$/);
 if(!match)return false;
 try{const url=new URL(match[2]),domain=new URL(/^https?:\/\//i.test(x.domain)?x.domain:'https://'+x.domain).hostname.replace(/^www\./,'').toLowerCase();return !url.username&&!url.password&&(url.hostname===domain||url.hostname.endsWith('.'+domain))}catch{return false}
}
function statements(value){return Array.isArray(value)?value.filter(x=>typeof x==='string'&&x.trim().length>=12):[]}
export function needsProspectPreparation(x){
 return x.qualificationLevel!=='low'&&x.communicationStatus!=='ready-for-review'&&
  (['new','analysis-queued'].includes(x.status)||(x.status==='analyzed'&&['','verified'].includes(x.contactStatus||'')));
}
export function evaluateOutreachPool(rows,{limit=50}={}){
 const ranked=[],excluded=[];
 for(const x of rows){
  if(x.replyStatus||x.clientId||['lost','won'].includes(x.crmStage)||['sent','follow-up-due'].includes(x.communicationStatus)){excluded.push({id:x.id,reason:'reply-customer-or-contacted'});continue}
  const qualification=Math.max(0,Math.min(100,Number(x.qualificationScore)||0));
  const findings=statements(x.scanFindings),actions=statements(x.scanRecommendations);
  const measured=x.scanScore!==null&&x.scanScore!==undefined&&Number.isFinite(Number(x.scanScore))&&Number(x.scanScore)>=0&&Number(x.scanScore)<=100;
  const analyzed=measured&&!!x.scanProvider&&!/test|demo|synthetic/i.test(x.scanProvider)&&findings.length>0&&actions.length>0;
  const reasons=[],specialty=officialSpecialty(x);
  let priority=Math.round(qualification*.15);
  if(specialty){priority+=20;reasons.push('resmî kaynaklı uzmanlık ve hedef müşteri açıklaması')}
  if(analyzed){priority+=Math.round((100-Number(x.scanScore))*.4);priority+=Math.min(10,actions.length*5);reasons.push('tamamlanmış analizde ihtiyaç ve uygulanabilir öneri')}
  if(x.contactStatus==='verified'&&x.contactEmail&&x.contactSourceUrl){priority+=15;reasons.push('doğrulanmış kurumsal iletişim kaydı')}
  const ready=analyzed&&qualification>=45&&!x.selectionBlocked&&x.contactStatus==='verified'&&!!x.contactEmail&&!!x.contactSourceUrl&&x.communicationStatus==='ready-for-review'&&x.outreachStatus==='drafted'&&x.proposalStatus==='drafted';
  ranked.push({...x,selectionPriority:priority,selectionReasons:reasons,selectionReady:ready,analysisRequired:!analyzed});
 }
 ranked.sort((a,b)=>b.selectionPriority-a.selectionPriority||String(a.createdAt||'').localeCompare(String(b.createdAt||''))||String(a.id).localeCompare(String(b.id)));
 const seen=new Set(),eligible=[];
 for(const x of ranked.filter(x=>x.selectionReady)){
  let domain='';try{domain=new URL(/^https?:\/\//i.test(x.domain)?x.domain:'https://'+x.domain).hostname.replace(/^www\./,'').toLowerCase()}catch{}
  const email=String(x.contactEmail||'').trim().toLowerCase();
  if(!domain||!email||seen.has(domain)||seen.has(email)){excluded.push({id:x.id,reason:'duplicate-or-missing-business'});continue}
  seen.add(domain);seen.add(email);eligible.push(x);
 }
 return {evaluated:rows.length,ranked,selected:eligible.slice(0,Math.max(0,Math.min(50,limit))),qualified:eligible.length,awaitingAnalysis:ranked.filter(x=>x.analysisRequired).length,excluded};
}
