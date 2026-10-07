export const REPORT_TIME_ZONE='Europe/Istanbul';
export function reportDay(value=new Date()){
 const date=new Date(value);if(Number.isNaN(date.getTime()))return '';
 return new Intl.DateTimeFormat('en-CA',{timeZone:REPORT_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
export function reportMarkets(runs){
 const entries=runs.flatMap(x=>Array.isArray(x.market?.markets)?x.market.markets:[x.market]).filter(x=>x?.country||x?.city);
 return [...new Map(entries.map(x=>[`${x.country||''}/${x.city||''}`,x])).values()];
}

export function reportAgentGroups(events=[]){
 const groups=[{id:'business',label:'İşletme ajanları',events:[]},{id:'creator',label:'Creator ajanları',events:[]},{id:'shared',label:'Ortak yönetim ve denetim',events:[]}];
 for(const event of events){
  const agent=String(event.agent||'');
  const group=/creator/i.test(agent)?groups[1]:/görünürlük|araştırma|içerik|satış|contact finder|proposal|personalization|communication|implementation|remeasurement/i.test(agent)?groups[0]:groups[2];
  group.events.push(event);
 }
 return groups;
}
