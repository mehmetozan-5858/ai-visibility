import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PDFDocument} from 'pdf-lib';
import {buildReportResponse} from '../lib/report-pdf.js';
const source=(await fs.readFile(new URL('../app/api/client-portal/report/route.js',import.meta.url),'utf8')).replace(/^import .*;$/gm,'').replace(/export /g,'');
function endpoint({session={clientId:'own'},account={client:{id:'own',status:'active'},payments:[{status:'paid'}],scans:[{status:'completed',score:42}]}}={}){
 const builds=[];
 const get=new Function('cookies','verifyClientToken','getClientAccount','buildReportResponse',source+';return GET')(
 async()=>({get:()=>({value:'token'})}),async()=>session,async id=>{assert.equal(id,'own');return account},async data=>{builds.push(data);return new Response('pdf',{headers:{'content-disposition':'attachment; filename=report.pdf'}})});
 return {get,builds};
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
