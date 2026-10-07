export const dashboardAgents=[{id:'research',name:'Araştırma Ajanı'},{id:'visibility',name:'Görünürlük Ajanı'},{id:'content',name:'İçerik Ajanı'},{id:'sales',name:'Satış Ajanı'}];
export function activityState(record,now=Date.now()){
 const time=Date.parse(record?.createdAt),age=now-time;
 if(!record||!Number.isFinite(time)||!Number.isFinite(now)||age<0)return {state:'unknown',label:'Kayıt doğrulanmadı',ageMinutes:null};
 const ageMinutes=Math.floor(age/60000);
 if(['failed','error','needs-attention'].includes(record.status))return {state:'attention',label:'Kontrol gereken kayıt',ageMinutes};
 if(age>90*60000)return {state:'old',label:'Eski hareket kaydı',ageMinutes};
 return {state:'recorded',label:record.status==='completed'?'Tamamlanmış hareket kaydı':'Hareket kaydı var',ageMinutes};
}
export function agentActivitySnapshot(events,now=new Date().toISOString()){
 const time=Date.parse(now);if(!Array.isArray(events)||!Number.isFinite(time))throw Error('agent-activity-unavailable');
 const valid=events.filter(x=>x&&Number.isFinite(Date.parse(x.createdAt))&&Date.parse(x.createdAt)<=time).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
 return {ok:true,generatedAt:now,limit:200,scope:'Son 200 hareket içinde yalnız ajanın kendi adıyla kayıtlı faaliyetler gösterilir. Yardımcı ajan olarak anılmak çalışma kanıtı sayılmaz. Hareket kaydı, ajanın şu anda çalıştığını veya tüm işlerini tamamladığını doğrulamaz. 90 dakika yalnız kayıt yaşı eşiğidir.',agents:dashboardAgents.map(a=>{const x=valid.find(x=>x.agent===a.name);return {...a,record:x?{createdAt:x.createdAt,status:x.status||'unknown'}:null}})};
}
export function readAgentActivity(value){
 if(value?.ok!==true||!Number.isFinite(Date.parse(value.generatedAt))||value.limit!==200||!Array.isArray(value.agents)||value.agents.length!==dashboardAgents.length||typeof value.scope!=='string')throw Error('agent-activity-unavailable');
 for(const a of dashboardAgents){const matches=value.agents.filter(x=>x?.id===a.id&&x.name===a.name);if(matches.length!==1)throw Error('agent-activity-unavailable');const r=matches[0].record;if(r!==null&&(!r||!Number.isFinite(Date.parse(r.createdAt))||Date.parse(r.createdAt)>Date.parse(value.generatedAt)||typeof r.status!=='string'))throw Error('agent-activity-unavailable');}
 return value;
}
export function businessRunState(run,now=Date.now()){
 const time=Date.parse(run?.finishedAt);
 if(!run||!Number.isFinite(time)||!Number.isFinite(now)||time>now||!Number.isInteger(run.errorCount)||run.errorCount<0)return 'BİLİNMİYOR';
 if(run.errorCount>0)return 'HATA KAYDI';
 return now-time<=90*60000?'GÜNCEL TUR KAYDI':'ESKİ TUR KAYDI';
}
