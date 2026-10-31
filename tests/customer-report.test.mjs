import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PDFDocument} from 'pdf-lib';
import {buildReportResponse} from '../lib/report-pdf.js';
const source=(await fs.readFile(new URL('../app/api/client-portal/report/route.js',import.meta.url),'utf8')).replace(/^import .*;$/gm,'').replace(/export /g,'');
function endpoint({comparisons=[],pilot=false,session={clientId:'own'},account={client:{id:'own',status:'active'},payments:[{status:'paid'}],scans:[{status:'completed',score:42}]}}={}){
 const builds=[],reads=[];
 const get=new Function('cookies','verifyClientToken','getClientAccount','buildReportResponse','customerAccess','readCustomerComparisonReport','databasePool','getDatabaseUrl',source+';return GET')(
 async()=>({get:()=>({value:'token'})}),async()=>session,async id=>{assert.equal(id,'own');return account},async data=>{builds.push(data);return new Response('pdf',{headers:{'content-disposition':'attachment; filename=report.pdf'}})},async a=>({allowed:!!a&&a.client?.status!=='payment-review'&&(pilot||(a.payments||[]).some(p=>p.status==='paid')),kind:pilot?'pilot':'paid'}),async (_pool,id)=>{reads.push(id);return comparisons},()=>({}),()=> 'fixture');
 return {get,builds,reads};
}
test('customer report requires session, payment, completed scan and ignores requested customer ID',async()=>{
 for(const [options,status] of [[{session:null},401],[{account:null},404],[{account:{client:{status:'payment-review'},payments:[{status:'paid'}]}},403],[{account:{client:{status:'active'},payments:[]}},403],[{account:{client:{status:'active'},payments:[{status:'paid'}],scans:[]}},409]]){
  const {get,builds}=endpoint(options);assert.equal((await get()).status,status);assert.equal(builds.length,0);
 }
 const {get,builds}=endpoint();assert.equal((await get(new Request('https://example.com/api/client-portal/report?clientId=other'))).status,200);
 assert.equal(builds[0].clientId,'own');assert.deepEqual(builds[0].allScans.map(s=>s.clientId),['own']);
});
test('PDF generator creates a valid document with Turkish and Unicode source content',async()=>{
 const response=await buildReportResponse({clientId:'own',clients:[{id:'own',name:'Test Müşteri',domain:'test.ai-visibility.local'}],allScans:[{clientId:'own',status:'completed',score:42,createdAt:'2026-10-06T15:00:00Z',results:[{provider:'Test Provider',score:42,findings:['Şema eksik → çözüm gerekli ⚙'],recommendations:['İçerik iyileştirmesi — test']}]}]});
 assert.equal(response.headers.get('content-type'),'application/pdf');
 const pdf=await PDFDocument.load(await response.arrayBuffer());assert.ok(pdf.getPageCount()>0);
});

test('approved pilot can download evidence-only PDF without a score; foreign URL selector is ignored',async()=>{
 const comparisons=[{clientId:'own',query:'fixture',results:[{provider:'gemini',status:'answer-received-unverified',answer:'fixture'}]}];
 const f=endpoint({pilot:true,comparisons,account:{client:{id:'own',status:'active'},payments:[],scans:[]}});
 const response=await f.get(new Request('https://example.com/api/client-portal/report?clientId=other'));
 assert.equal(response.status,200);assert.deepEqual(f.reads,['own']);assert.equal(f.builds[0].pilot,true);
 assert.deepEqual(f.builds[0].allScans,[]);assert.deepEqual(f.builds[0].comparisons,comparisons);
 assert.match(response.headers.get('cache-control'),/private.*no-store/);assert.equal(response.headers.get('vary'),'Cookie');
});
test('existing scored report does not depend on comparison storage; unauthorized requests never read comparisons',async()=>{
 const f=endpoint();await f.get();assert.deepEqual(f.reads,[]);
 for(const config of [{session:null},{account:null},{account:{client:{status:'active'},payments:[],scans:[]}}]){
  const denied=endpoint(config);await denied.get();assert.deepEqual(denied.reads,[]);
 }
});
