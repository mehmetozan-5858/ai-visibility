/** Deterministic ZERA queue: Google search evidence is never presented as AI results. */
export const ZERA_TASKS=Object.freeze([
 {id:'brand-google-de',channel:'google',query:'ZERA Clothing Wetzlar'},
 {id:'local-google-de',channel:'google',query:'Damenmode Wetzlar Boutique Termin'},
 {id:'modest-google-de',channel:'google',query:'Modest Fashion Wetzlar'},
 {id:'turkish-google-de',channel:'google',query:'Wetzlar tesettür giyim mağazası'},
 {id:'competitor-google-de',channel:'google',query:'Damenmode Boutiquen Wetzlar'},
 {id:'brand-ai-de',channel:'ai-answer',query:'Welche Modeboutiquen gibt es in Wetzlar?'},
 {id:'brand-ai-tr',channel:'ai-answer',query:'Wetzlar çevresinde kadın giyim butiklerini öner'}
]);
export function zeraTaskSummary(observations=[]){
 const byId=new Map(observations.filter(o=>ZERA_TASKS.some(t=>t.id===o.taskId)).map(o=>[o.taskId,o]));
 const tasks=ZERA_TASKS.map(t=>{
  const o=byId.get(t.id);
  const confirmed=Boolean(o&&o.channel===t.channel&&o.status==='evidence-recorded'&&o.verified===true&&typeof o.sourceUrl==='string'&&/^https:\/\//.test(o.sourceUrl));
  return {...t,status:confirmed?'evidence-recorded':o?.status==='failed'?'failed':'pending'};
 });
 return {total:tasks.length,verified:tasks.filter(t=>t.status==='evidence-recorded').length,
  pending:tasks.filter(t=>t.status==='pending').length,failed:tasks.filter(t=>t.status==='failed').length,tasks};
}
export function shouldStopZeraRun({attempts=0,providerStatus='',freeTierConfirmed=false,enabled=false}={}){
 if(!enabled||!freeTierConfirmed)return 'gate-closed';
 if(attempts>=2)return 'attempt-limit';
 if(['failed','provider-temporarily-unavailable','provider-quota-or-rate-limit','provider-model-not-found','provider-permission-denied'].includes(providerStatus))return 'provider-stop';
 return null;
}
