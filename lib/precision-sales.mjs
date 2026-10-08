export const WEIGHTS = Object.freeze({problem:35,intent:25,capacity:20,contact:10,fit:10});
export function scoreLead(lead){
  const dimensions={};let total=0;
  for(const [key,weight] of Object.entries(WEIGHTS)){
    const evidence=lead?.evidence?.[key];
    const valid=Boolean(evidence && typeof evidence.url==='string' && /^https?:\\/\\//i.test(evidence.url) && typeof evidence.observedAt==='string' && !Number.isNaN(Date.parse(evidence.observedAt)) && typeof evidence.note==='string' && evidence.note.trim());
    const confidence=valid && Number.isFinite(evidence.confidence)?Math.max(0,Math.min(1,evidence.confidence)):0;
    dimensions[key]={points:Math.round(weight*confidence),verified:valid};total+=dimensions[key].points;
  }
  return {total,dimensions,tier:total>=85?'priority':total>=70?'research':'hold',readyForOutreach:false};
}
export function rankLeads(leads){return leads.map(lead=>({...lead,qualification:scoreLead(lead)})).sort((a,b)=>b.qualification.total-a.qualification.total || String(a.name??'').localeCompare(String(b.name??'')));}
