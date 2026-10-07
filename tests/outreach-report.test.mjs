import test from 'node:test';
import assert from 'node:assert/strict';
import {emailText,outreachReportRow} from '../lib/outreach-report-rules.js';
test('shows persisted message rather than a newly generated draft and decodes escaped text once',()=>{
 const payload={html:'<div><h2>AI Visibility</h2><p>Merhaba A &amp; B<br/>İzin verir misiniz? &lt;örnek&gt; &#39;x&#39;</p></div>'};
 assert.equal(emailText(payload),'AI Visibility\n\nMerhaba A & B\nİzin verir misiniz? <örnek> \'x\'');
 assert.equal(emailText({text:'Exact\nbody',html:'other'}),'Exact\nbody');
 assert.equal(emailText({html:'<script>bad()</script><style>bad</style><p>Safe</p>'}),'Safe');
});
test('never labels unknown attempts or finalized records without provider acknowledgement as sent',()=>{
 const base={delivery_key:'prospect-first/123',status:'completed',first_attempt_at:'2026-10-07T10:00:00Z',payload:{to:['a@firm.com'],subject:'Subject',text:'Body'}};
 assert.equal(outreachReportRow(base).accepted,false);
 const sent=outreachReportRow({...base,provider_id:'provider-1',completed_at:'2026-10-07T10:01:00Z',name:'Firm',country:'Türkiye',city:'Ankara'});
 assert.equal(sent.accepted,true);assert.equal(sent.status,'Sağlayıcı kabul etti');assert.equal(sent.body,'Body');assert.equal(sent.recordedAt,'2026-10-07T10:01:00Z');assert.equal(sent.city,'Ankara');
 assert.equal(outreachReportRow({...base,delivery_key:'prospect-follow/123/1'}).kind,'Takip');
});
import {readFile} from 'node:fs/promises';
import {validReportDate} from '../lib/reporting.js';
const source=(await readFile(new URL('../lib/outreach-daily-report.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replace(/export /g,'');
const dailyOutreachReport=new Function('validReportDate','outreachReportRow',source+';return dailyOutreachReport;')(validReportDate,outreachReportRow);
test('daily emails use Istanbul day bounds and durable keys, without counting drafts or repeated attempts twice',async()=>{
 let calls=0;const pool={query:async(sql,params)=>{calls++;if(calls===1)return {rows:[{deliveries:'email_deliveries',prospects:'prospects'}]};assert.deepEqual(params,['2026-10-07']);assert.match(sql,/COALESCE\(d.completed_at,d.first_attempt_at\)>=/);assert.match(sql,/COALESCE\(d.completed_at,d.first_attempt_at\)</);assert.match(sql,/AT TIME ZONE 'Europe\/Istanbul'/);assert.match(sql,/prospect-follow\/\%/);assert.match(sql,/LEFT JOIN prospects/);return {rows:[{delivery_key:'prospect-first/a',status:'completed',provider_id:'ack',total:'2',accepted:'1',payload:{text:'original'}},{delivery_key:'prospect-first/b',status:'sending',total:'2',accepted:'1',payload:{text:'uncertain'}}]}}};
 const r=await dailyOutreachReport('2026-10-07',{pool});assert.equal(r.accepted,1);assert.equal(r.uncertain,1);assert.equal(r.rows.length,2);assert.equal(r.rows[0].body,'original');assert.equal(r.rows[1].accepted,false);
 await assert.rejects(dailyOutreachReport('2026-02-31',{pool}));assert.equal(calls,2);
});
test('absent durable table means no records while database failure stays unavailable',async()=>{
 const r=await dailyOutreachReport('2026-10-07',{pool:{query:async()=>({rows:[{}]})}});assert.equal(r.available,true);assert.equal(r.total,0);assert.deepEqual(r.rows,[]);
 await assert.rejects(dailyOutreachReport('2026-10-07',{pool:{query:async()=>{throw Error('offline')}}}));
});
