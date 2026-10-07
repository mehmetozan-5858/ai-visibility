import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {evaluateOutreachPool,needsProspectPreparation,selectPreparationCandidates} from '../lib/outreach-selection.js';
const source=(await readFile(new URL('../app/api/cron/daily-cycle/route.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replace(/export /g,'');
test('large existing pool advances analyses without spending the cycle on more discovery',async()=>{
 let discovery=0,scans=0,release=0,unlock=0;const candidates=Array.from({length:60},(_,i)=>({id:String(i),name:`Company ${i}`,status:'new',qualificationLevel:'hot',qualificationScore:80}));
 const client={query:async sql=>{if(sql.includes('unlock'))unlock++;return {rows:[{acquired:true}]}},release(){release++}};
 const deps={evaluateOutreachPool,needsProspectPreparation,selectPreparationCandidates,nicheSearchSector:()=>'',databasePool:()=>({connect:async()=>client}),getDatabaseUrl:()=> 'configured',withRequestBudget:async(ms,fn)=>fn(),discoverBusinesses:async()=>{discovery++;return []},runProviderCheck:async()=>{scans++;return {score:20,provider:'Gemini',findings:['Verified improvement'],recommendations:['Add structured data']}},findPublicBusinessContact:async()=>({status:'not-found'}),getProspectNames:async()=>[],seedProspects:async()=>[],qualifyProspect:async()=>{},queueProspectScan:async()=>({id:'scan',status:'queued'}),completeProspectScan:async()=>{},saveProspectContact:async()=>({contactStatus:'not-found'}),listOutreachEvaluationCandidates:async()=>candidates,addSharedAgentEvent:async()=>{},saveDailyAgentReport:async()=>({id:'report'}),learnFromMarketRun:async()=>{},listMarketLearning:async()=>[],refreshMarketEconomics:async()=>{},listLearnedPolicies:async()=>[],refreshBudgetGuard:async()=>({mode:'normal',multiplier:1}),process:{env:{AUTO_HUNT_SECRET:'fixture-key'}},console:{log(){},error(){}}};
 const get=new Function(...Object.keys(deps),source+';return GET;')(...Object.values(deps));
 const r=await get(new Request('https://example.com/api/cron/daily-cycle',{headers:{authorization:'Bearer fixture-key'}}));const report=await r.json();
 assert.equal(r.status,200);assert.equal(report.mode,'backlog-preparation');assert.equal(discovery,0);assert.equal(scans,2);assert.equal(report.completed,2);assert.equal(report.preparedCandidates.length,2);assert.equal(release,1);assert.equal(unlock,1);
});
