import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validReportDate} from '../lib/reporting.js';
const raw=await readFile(new URL('../lib/agent-coordination.js',import.meta.url),'utf8');
const method=raw.slice(raw.indexOf('export async function listDailyAgentReports('),raw.indexOf('export async function addSharedAgentEvent(')).replace('export ','');
test('daily report filters the requested day before limiting instead of losing early runs as the queue grows',async()=>{
 const calls=[];const fn=new Function('withDb','validReportDate',method+';return listDailyAgentReports;')(cb=>cb({query:async(sql,args)=>{calls.push({sql,args});return {rows:[]}}}),validReportDate);
 await fn(90,'2026-10-08');assert.match(calls[0].sql,/WHERE report_date=\$2::date/);assert.deepEqual(calls[0].args,[1000,'2026-10-08']);
 await fn(30);assert.doesNotMatch(calls[1].sql,/WHERE/);assert.deepEqual(calls[1].args,[30]);
 await assert.rejects(fn(90,'2026-02-31'),/invalid-report-date/);assert.equal(calls.length,2);
});
