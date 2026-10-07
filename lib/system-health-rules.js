export function systemHealthSnapshot(items,now=new Date().toISOString()){
 const time=Date.parse(now);if(!Array.isArray(items)||!Number.isFinite(time))throw Error('health-source-unavailable');
 const components=items.map(x=>{
  const last=Date.parse(x.lastSuccessAt),interval=Number(x.expectedIntervalMinutes),quarantine=Date.parse(x.quarantineUntil),ageMinutes=Number.isFinite(last)&&last<=time?Math.floor((time-last)/60000):null;
  const state=Number.isFinite(quarantine)&&quarantine>time?'quarantined':x.severity==='critical'?'critical':ageMinutes===null||!Number.isFinite(interval)||interval<=0?'unknown':time-last>interval*120000?'delayed':x.lastStatus==='healthy'?'healthy':'warning';
  return {...x,ageMinutes,state};
 });
 const counts={healthy:0,warning:0,delayed:0,critical:0,quarantined:0,unknown:0};for(const x of components)counts[x.state]++;
 return {ok:true,counts,components,generatedAt:now,scope:'Son kaydedilmiş kontrol ve başarı zamanlarına dayanır. Güncel başarı kaydı, ajanın şu anda çalıştığı veya bütün görevlerinin tamamlandığı anlamına gelmez.'};
}
export function readSystemHealthSnapshot(value){
 if(value?.ok!==true||!Array.isArray(value.components)||!Number.isFinite(Date.parse(value.generatedAt)))throw Error('health-source-unavailable');
 const states=['healthy','warning','delayed','critical','quarantined','unknown'];
 if(value.components.some(x=>!x.componentKey||!states.includes(x.state))||states.some(s=>!Number.isInteger(value.counts?.[s])||value.counts[s]<0||value.counts[s]!==value.components.filter(x=>x.state===s).length))throw Error('health-source-unavailable');
 return value;
}
