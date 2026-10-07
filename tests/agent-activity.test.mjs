import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {activityState,agentActivitySnapshot,readAgentActivity,businessRunState} from '../lib/agent-activity-rules.js';
const now='2026-10-07T12:00:00Z',time=Date.parse(now);
test('dashboard credits only exact primary actors and picks the newest valid record',()=>{
 const events=[{agent:'CEO Ajanı',helperAgent:'Satış Ajanı',createdAt:now,status:'completed'},{agent:'Creator Görünürlük Ajanı',createdAt:now,status:'completed'},{agent:'Görünürlük Ajanı',createdAt:'2026-10-07T10:00:00Z',status:'completed'},{agent:'Görünürlük Ajanı',createdAt:'2026-10-07T11:00:00Z',status:'needs-attention',payload:{secret:'omit'}},{agent:'Görünürlük Ajanı',createdAt:'2026-10-08T12:00:00Z',status:'completed'}];
 const d=agentActivitySnapshot(events,now);assert.equal(readAgentActivity(d),d);assert.equal(d.agents.find(x=>x.id==='sales').record,null);assert.equal(d.agents.find(x=>x.id==='content').record,null);const v=d.agents.find(x=>x.id==='visibility').record;assert.equal(v.createdAt,'2026-10-07T11:00:00Z');assert.equal(v.status,'needs-attention');assert.equal(v.payload,undefined);
});
test('activity age is not current-running proof and failed or invalid records stay explicit',()=>{
 assert.equal(activityState(null,time).state,'unknown');assert.equal(activityState({createdAt:'invalid'},time).state,'unknown');assert.equal(activityState({createdAt:'2026-10-08T12:00:00Z'},time).state,'unknown');assert.equal(activityState({createdAt:'2026-10-07T10:30:00Z',status:'completed'},time).state,'recorded');assert.equal(activityState({createdAt:'2026-10-07T10:29:59Z',status:'completed'},time).state,'old');assert.equal(activityState({createdAt:now,status:'failed'},time).state,'attention');assert.equal(activityState({createdAt:now,status:'open'},time).label,'Hareket kaydı var');
 assert.equal(businessRunState({finishedAt:now,errorCount:0},time),'GÜNCEL TUR KAYDI');assert.equal(businessRunState({finishedAt:'2026-10-07T09:00:00Z',errorCount:0},time),'ESKİ TUR KAYDI');assert.equal(businessRunState({finishedAt:now,errorCount:2},time),'HATA KAYDI');for(const r of [null,{finishedAt:now},{finishedAt:'invalid',errorCount:0},{finishedAt:'2026-10-08T12:00:00Z',errorCount:0}])assert.equal(businessRunState(r,time),'BİLİNMİYOR');
});
test('malformed activity responses never produce active badges',()=>{
 const d=agentActivitySnapshot([],now);for(const change of [{agents:[]},{agents:[...d.agents.slice(0,3),d.agents[0]]},{generatedAt:'invalid'},{agents:d.agents.map(x=>({...x,record:{createdAt:'2026-10-08T12:00:00Z',status:'completed'}}))}])assert.throws(()=>readAgentActivity({...d,...change}));assert.throws(()=>agentActivitySnapshot(null,now));
});
const source=(await readFile(new URL('../app/api/agent-activity/route.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replace(/export /g,'');
test('activity API authorizes before reads and source failure stays unknown without leaking errors',async()=>{
 for(const mode of ['denied','missing','offline','ok']){let reads=0;const deps={requireAdmin:async()=>mode==='denied'?Response.json({error:'auth'},{status:401}):null,getDatabaseUrl:()=>mode!=='missing',listSharedAgentEvents:async limit=>{reads++;assert.equal(limit,200);if(mode==='offline')throw Error('private connection');return []},agentActivitySnapshot};const GET=new Function(...Object.keys(deps),source+';return GET;')(...Object.values(deps));const r=await GET({}),d=await r.json();assert.equal(r.status,mode==='denied'?401:mode==='ok'?200:503);assert.equal(reads,['offline','ok'].includes(mode)?1:0);if(mode!=='denied')assert.equal(r.headers.get('cache-control'),'no-store');assert.doesNotMatch(JSON.stringify(d),/private connection/);if(mode==='ok'){assert.equal(d.agents.length,4);assert.ok(d.agents.every(x=>x.record===null))}else assert.equal(d.agents,undefined);}
});
