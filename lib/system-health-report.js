import {listSystemWatchdog} from './agent-coordination';
import {getDatabaseUrl} from './db';
import {systemHealthSnapshot,readSystemHealthSnapshot} from './system-health-rules.js';
export async function systemHealthReport(deps={}){
 if(!(deps.databaseUrl||getDatabaseUrl)())throw Error('health-source-unavailable');
 const snapshot=readSystemHealthSnapshot(systemHealthSnapshot(await (deps.list||listSystemWatchdog)(),(deps.now||(()=>new Date().toISOString()))()));
 const priority={critical:0,quarantined:1,delayed:2,unknown:3,warning:4};
 return {available:true,snapshotType:'current',asOf:snapshot.generatedAt,counts:snapshot.counts,total:snapshot.components.length,scope:snapshot.scope,entries:snapshot.components.filter(x=>x.state!=='healthy').sort((a,b)=>priority[a.state]-priority[b.state]||a.componentKey.localeCompare(b.componentKey)).slice(0,5).map(x=>({componentKey:x.componentKey,state:x.state,lastSeenAt:x.lastSeenAt,lastSuccessAt:x.lastSuccessAt,expectedIntervalMinutes:x.expectedIntervalMinutes,ageMinutes:x.ageMinutes}))};
}
