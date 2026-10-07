import {permissionEnquiry} from '../lib/outreach-quality.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {evaluateOutreachPool} from '../lib/outreach-selection.js';
import {publicAddress,contactPageUrl,pageContainsAddress} from '../lib/contact-page-verification.js';
const source=(await readFile(new URL('../lib/automatic-outreach.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replace(/export /g,'');
const {outreachPolicy,automaticRecipientIssue,permissionMessage,runAutomaticOutreach}=new Function('evaluateOutreachPool','permissionEnquiry',source+'\nreturn {outreachPolicy,automaticRecipientIssue,permissionMessage,runAutomaticOutreach};')(evaluateOutreachPool,permissionEnquiry);
const prospect=(id='one')=>({id,name:'Example Business '+id,country:'Germany',domain:id+'.business.de',contactSourceUrl:'https://'+id+'.business.de/contact',contactStatus:'verified',contactEmail:'info@'+id+'.business.de',communicationStatus:'ready-for-review',qualificationScore:80,outreachStatus:'drafted',proposalStatus:'drafted',scanScore:40,scanProvider:'Perplexity',scanFindings:['Product descriptions need clear structured markup.'],scanRecommendations:['Add structured product schema and buyer-specific FAQ.']});
function fixture({today=0,hour=0,locked=true,blocked='',verify=true,rows=[prospect()],follow=[]}={}){
 const state={sends:[],reports:[],unlocked:false,released:false,lockSql:[]};const client={query:async sql=>{state.lockSql.push(sql);if(sql==='ROLLBACK')state.unlocked=true;return {rows:[{acquired:locked}]}},release:()=>{state.released=true}};
 const pool={connect:async()=>client,query:async(sql,p)=>{if(sql.includes('count(*)'))return{rows:[{total:sql.includes("date_trunc('hour'")?hour:today}]};if(sql.includes('INSERT INTO outreach_cycle_reports'))state.reports.push(JSON.parse(p[0]));return{rows:[]}}};
 const deps={env:{OUTREACH_SEND_ENABLED:'true',OUTREACH_DAILY_LIMIT:'20',OUTREACH_CYCLE_LIMIT:'3'},pool,listFirst:async()=>rows,listFollow:async()=>follow,getProspect:async id=>[...rows,...follow].find(x=>x.id===id),blocked:async()=>blocked,verify:async()=>verify,followDelivery:async()=>'',send:async(x,opts)=>{state.sends.push({x,key:opts.key});return{id:'provider'}},pause:async()=>{},noEvents:true};return{deps,state};
}
test('recipient must match official source and email domain',()=>{
 assert.equal(automaticRecipientIssue(prospect()),'');
 for(const x of [{...prospect(),contactEmail:'person@gmail.com'},{...prospect(),contactSourceUrl:'https://directory.org/business'},{...prospect(),replyStatus:'replied'},{...prospect(),clientId:'customer'},{...prospect(),name:'Berlin-Klinik'}])assert.ok(automaticRecipientIssue(x));
});
test('page verification rejects private destinations and address substrings',()=>{
 for(const ip of ['127.0.0.1','169.254.169.254','10.1.1.1','192.168.0.1','::1'])assert.equal(publicAddress(ip),false);
 assert.equal(publicAddress('8.8.8.8'),true);
 for(const raw of ['http://business.de','https://127.0.0.1','https://evil.de','https://business.de:444'])assert.throws(()=>contactPageUrl(raw,'business.de'));
 assert.equal(pageContainsAddress('<a href="mailto:info@business.de">Email</a>','info@business.de'),true);
 assert.equal(pageContainsAddress('notinfo@business.de','info@business.de'),false);
});
test('permission messages contain no unsupported audit scores or prices',()=>{
 const text=permissionMessage(prospect());assert.match(text,/Would you be interested/);assert.match(text,/stop contacting/);assert.doesNotMatch(text,/35\/100|19900|guaranteed improvement/);
 assert.match(permissionMessage({...prospect(),country:'Türkiye'}),/tekrar iletişim kurmayacağız/);assert.match(permissionMessage(prospect(),true),/follow-up/);
});
test('disabled policy sends nothing and dry run never transmits',async()=>{
 const f=fixture();f.deps.env.OUTREACH_SEND_ENABLED='false';assert.equal((await runAutomaticOutreach({deps:f.deps})).skippedReason,'sending-disabled');assert.equal(f.state.sends.length,0);
 const r=await runAutomaticOutreach({deps:f.deps,dryRun:true});assert.equal(r.eligible,1);assert.equal(f.state.sends.length,0);assert.equal(f.state.reports.length,1);
});
test('daily and cycle limits cap sends; operation keys stable; locks released',async()=>{
 const rows=Array.from({length:5},(_,i)=>prospect('p'+i));const f=fixture({rows});const r=await runAutomaticOutreach({deps:f.deps});assert.equal(r.sent,3);assert.equal(f.state.sends[0].key,'prospect-first/p0');assert.equal(f.state.unlocked,true);assert.equal(f.state.released,true);
 const g=fixture({rows,today:19});assert.equal((await runAutomaticOutreach({deps:g.deps})).sent,1);const h=fixture({today:20});assert.equal((await runAutomaticOutreach({deps:h.deps})).sent,0);
});
test('5 per hour and 50 per Istanbul day share capacity across jobs, reruns and uncertain attempts',async()=>{
 assert.equal(outreachPolicy({OUTREACH_DAILY_LIMIT:'999',OUTREACH_CYCLE_LIMIT:'999'}).dailyLimit,50);
 const rows=Array.from({length:60},(_,i)=>prospect('p'+i));
 const f=fixture({rows});f.deps.env.OUTREACH_DAILY_LIMIT='50';f.deps.env.OUTREACH_CYCLE_LIMIT='5';
 assert.equal((await runAutomaticOutreach({deps:f.deps})).sent,5);
 const g=fixture({rows,today:49,hour:4});g.deps.env=f.deps.env;
 assert.equal((await runAutomaticOutreach({deps:g.deps})).sent,1);
 const h=fixture({rows,hour:5});h.deps.env=f.deps.env;assert.equal((await runAutomaticOutreach({deps:h.deps})).sent,0);
 const k=fixture({rows,today:50});k.deps.env=f.deps.env;assert.equal((await runAutomaticOutreach({deps:k.deps})).sent,0);
 const j=fixture({rows});j.deps.env=f.deps.env;let attempts=0;j.deps.send=async()=>{attempts++;throw Error('provider-timeout')};await runAutomaticOutreach({deps:j.deps});assert.equal(attempts,5);
});
test('replies, duplicate recipients and failed verification block transmission',async()=>{
 for(const options of [{blocked:'inbound-reply'},{verify:false},{locked:false}]){const f=fixture(options);await runAutomaticOutreach({deps:f.deps});assert.equal(f.state.sends.length,0)}
 const a=prospect('a'),b={...prospect('b'),contactEmail:a.contactEmail};const f=fixture({rows:[a,b]});const r=await runAutomaticOutreach({deps:f.deps});assert.equal(r.sent,1);assert.equal(r.selection.selected.length,1);
});
test('reply arriving during verification is checked again before sending',async()=>{
 const f=fixture();let checks=0;f.deps.blocked=async()=>++checks===1?'':'inbound-reply';const r=await runAutomaticOutreach({deps:f.deps});assert.equal(r.sent,0);assert.equal(checks,2);
});
test('transaction pool lock is pinned by BEGIN and released even when another run owns it',async()=>{
 for(const locked of [true,false]){const f=fixture({locked});await runAutomaticOutreach({deps:f.deps});assert.equal(f.state.lockSql[0],'BEGIN');assert.match(f.state.lockSql[1],/pg_try_advisory_xact_lock/);assert.equal(f.state.lockSql.at(-1),'ROLLBACK');assert.equal(f.state.released,true);assert.ok(f.state.lockSql.every(x=>!x.includes('pg_advisory_unlock')))}
});
test('follow up needs due time, count below two and verified first delivery',async()=>{
 const row={...prospect(),communicationStatus:'sent',followUpCount:0,followUpAt:'2020-01-01'};const f=fixture({rows:[],follow:[row]});assert.equal((await runAutomaticOutreach({deps:f.deps,mode:'follow'})).followSent,1);assert.equal(f.state.sends[0].key,'prospect-follow/one/0');
 for(const change of [{followUpCount:2},{followUpAt:'2099-01-01'},{replyStatus:'not-interested'}]){const g=fixture({rows:[],follow:[{...row,...change}]});assert.equal((await runAutomaticOutreach({deps:g.deps,mode:'follow'})).sent,0)}
 const g=fixture({rows:[],follow:[row]});g.deps.followDelivery=async()=>'delivery-not-verified';assert.equal((await runAutomaticOutreach({deps:g.deps,mode:'follow'})).sent,0);
});
test('automatic route requires admin for manual runs and scheduler credential for scheduled writes',async()=>{
 const raw=(await readFile(new URL('../app/api/outreach-cycle/route.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replace(/export /g,'');let calls=0;
 const api=new Function('requireAdmin','enforceSameOrigin','runAutomaticOutreach','automaticOutreachStatus','process',raw+'\nreturn {GET,POST};')(async()=>Response.json({error:'unauthorized'},{status:401}),()=>null,async()=>{calls++;return{ok:true}},async()=>({}),{env:{AUTO_HUNT_SECRET:'secret'}});
 assert.equal((await api.POST(new Request('https://example.org/api/outreach-cycle',{method:'POST',body:'{}'}))).status,401);
 assert.equal((await api.GET(new Request('https://example.org/api/outreach-cycle'))).status,401);assert.equal(calls,0);
 assert.equal((await api.GET(new Request('https://example.org/api/outreach-cycle',{headers:{authorization:'Bearer secret'}}))).status,200);assert.equal(calls,1);
});
