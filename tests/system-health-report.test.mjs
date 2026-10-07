import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {systemHealthSnapshot,readSystemHealthSnapshot} from '../lib/system-health-rules.js';
import {reportDay,reportMarkets,validReportDate} from '../lib/reporting.js';
const source=(await readFile(new URL('../lib/system-health-report.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replace(/export /g,'');
const systemHealthReport=new Function('systemHealthSnapshot','readSystemHealthSnapshot',source+';return systemHealthReport;')(systemHealthSnapshot,readSystemHealthSnapshot);
const now='2026-10-07T12:00:00Z';
const row={componentKey:'agent',lastSuccessAt:'2026-10-07T11:00:00Z',lastStatus:'healthy',expectedIntervalMinutes:60};
test('health report counts all records and bounds prioritized review to five metadata-only entries',async()=>{
 const rows=[row,...Array.from({length:7},(_,i)=>({...row,componentKey:'unknown-'+i,lastSuccessAt:null})),{...row,componentKey:'critical',severity:'critical',detail:'private detail'},{...row,componentKey:'late',lastSuccessAt:'2026-10-07T08:00:00Z'}];
 const d=await systemHealthReport({databaseUrl:()=>true,list:async()=>rows,now:()=>now});assert.equal(d.available,true);assert.equal(d.snapshotType,'current');assert.equal(d.asOf,now);assert.equal(d.total,10);assert.equal(d.counts.unknown,7);assert.equal(d.entries.length,5);assert.deepEqual(d.entries.slice(0,2).map(x=>x.componentKey),['critical','late']);assert.equal(d.entries.some(x=>x.state==='healthy'),false);assert.equal(d.entries[0].detail,undefined);assert.equal(Object.values(d.counts).reduce((a,b)=>a+b),d.total);
});
test('health source absence stays unavailable while genuine empty records remain explicit',async()=>{
 let reads=0;await assert.rejects(systemHealthReport({databaseUrl:()=>false,list:async()=>{reads++;return []}}));assert.equal(reads,0);
 await assert.rejects(systemHealthReport({databaseUrl:()=>true,list:async()=>{throw Error('offline')}}));const d=await systemHealthReport({databaseUrl:()=>true,list:async()=>[],now:()=>now});assert.equal(d.total,0);assert.deepEqual(d.entries,[]);assert.equal(d.available,true);
});
const route=(await readFile(new URL('../app/api/executive-daily-report/route.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replace(/export /g,'');
function api({offline=false,denied=false}={}){let healthReads=0;const deps={systemHealthReport:async()=>{healthReads++;if(offline)throw Error('private source error');return {available:true,snapshotType:'current',asOf:now,counts:{healthy:2}}},implementationReport:async()=>({available:false}),dailyAnswerEvidence:async()=>({available:true,counts:{runs:3}}),reportDay,reportMarkets,validReportDate,requireAdmin:async()=>denied?Response.json({error:'auth'},{status:401}):null};for(const name of ['listDailyAgentReports','listSharedAgentEvents','listCreatorHuntLeads','getPredictiveRiskSignals','listMarketLearning','listPredictiveAlerts','listAutonomousActions','listStrategyLearning','listNextBestActions','getExperimentPerformance','listOpportunityForecasts','getProfitControlSnapshot','listProviderHealth'])deps[name]=async()=>[];deps.getExecutiveFunnelSnapshot=async()=>({prospects:{total:10}});return {GET:new Function(...Object.keys(deps),route+';return GET;')(...Object.values(deps)),reads:()=>healthReads}}
test('historical daily report preserves a separately dated current health snapshot and survives health failure',async()=>{
 for(const offline of [false,true]){const f=api({offline});const r=await f.GET(new Request('https://example.com/api?date=2026-10-01'));const d=await r.json();assert.equal(r.status,200);assert.equal(d.date,'2026-10-01');assert.equal(d.funnel.prospects.total,10);assert.equal(d.answerEvidence.counts.runs,3);assert.equal(d.systemHealth.available,!offline);if(offline){assert.equal(d.systemHealth.counts,undefined);assert.match(d.systemHealth.error,/bilinmiyor/);assert.doesNotMatch(JSON.stringify(d),/private source/)}else{assert.equal(d.systemHealth.asOf,now);assert.equal(d.systemHealth.snapshotType,'current')}assert.equal(r.headers.get('cache-control'),'no-store');}
 const denied=api({denied:true});assert.equal((await denied.GET(new Request('https://example.com/api'))).status,401);assert.equal(denied.reads(),0);const invalid=api();assert.equal((await invalid.GET(new Request('https://example.com/api?date=2026-02-31'))).status,400);assert.equal(invalid.reads(),0);
});
