import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readDashboardEvidence} from '../lib/dashboard-evidence.js';
import {reportDay,validReportDate} from '../lib/reporting.js';
import {summarizeDailyAnswerEvidence} from '../lib/answer-evidence-daily-rules.js';
const zero={available:true,date:'2026-10-07',generatedAt:'2026-10-07T12:00:00Z',limited:false,totalRuns:0,counts:{runs:0,neutralComplete:0,brandMentions:0,officialCitations:0,failed:0}};
test('dashboard distinguishes genuine zero measurements from unknown or inconsistent counts',()=>{
 assert.equal(readDashboardEvidence(zero),zero);for(const change of [{available:false},{counts:{}},{totalRuns:null},{generatedAt:'invalid'},{counts:{...zero.counts,brandMentions:1}},{counts:{...zero.counts,officialCitations:1}},{counts:{...zero.counts,runs:1}},{counts:{...zero.counts,failed:-1}}])assert.throws(()=>readDashboardEvidence({...zero,...change}));
});
test('dashboard uses only neutral complete observations for mentions and citations',()=>{
 const sample={provider:'ChatGPT',brandPrompted:false,truncated:false,brandMentioned:true,officialCitation:true};const d=summarizeDailyAnswerEvidence([{result:{observations:[sample,{...sample,brandPrompted:true},{...sample,truncated:true},{...sample,brandPrompted:undefined}],errors:[{provider:'Gemini'}]}}]);assert.equal(d.counts.neutralComplete,1);assert.equal(d.counts.brandMentions,1);assert.equal(d.counts.officialCitations,1);assert.equal(d.counts.failed,1);assert.equal(readDashboardEvidence({...zero,...d,totalRuns:1}).counts.runs,1);
});
const source=(await readFile(new URL('../app/api/answer-evidence/daily/route.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replace(/export /g,'');
function api({denied=false,offline=false}={}){let reads=0,day;const deps={requireAdmin:async()=>denied?Response.json({error:'auth'},{status:401}):null,reportDay:()=>reportDay('2026-10-07T21:01:00Z'),validReportDate,dailyAnswerEvidence:async date=>{reads++;day=date;if(offline)throw Error('private database URL');return {...zero,date}}};return {GET:new Function(...Object.keys(deps),source+';return GET;')(...Object.values(deps)),reads:()=>reads,day:()=>day}}
test('daily evidence API enforces admin and calendar validation before source reads',async()=>{
 const denied=api({denied:true});assert.equal((await denied.GET(new Request('https://example.com/api'))).status,401);assert.equal(denied.reads(),0);const bad=api();assert.equal((await bad.GET(new Request('https://example.com/api?date=2026-02-31'))).status,400);assert.equal(bad.reads(),0);
});
test('daily API uses Istanbul day and source errors never become empty measurements',async()=>{
 for(const offline of [false,true]){const f=api({offline}),r=await f.GET(new Request('https://example.com/api')),d=await r.json();assert.equal(f.day(),'2026-10-08');assert.equal(r.status,offline?503:200);assert.equal(r.headers.get('cache-control'),'no-store');if(offline){assert.equal(d.available,false);assert.equal(d.counts,undefined);assert.doesNotMatch(JSON.stringify(d),/private database/)}else{assert.equal(readDashboardEvidence(d).counts.runs,0);assert.equal(d.date,'2026-10-08');}}
});
