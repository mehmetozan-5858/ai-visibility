import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=(await readFile(new URL('../app/api/client-portal/report/route.js',import.meta.url),'utf8')).replace(/^import .*;\s*$/gm,'').replace(/export /g,'');
function handler({session={clientId:'own-client'},account={client:{id:'own-client'},scans:[]},allowed=true,failRead=false,comparisons=[]}={}){
 const calls=[];
 const names=['cookies','verifyClientToken','getClientAccount','customerAccess','readCustomerComparisonReport','databasePool','getDatabaseUrl','buildReportResponse'];
 const values=[async()=>({get:()=>({value:'synthetic-session'})}),async()=>session,
  async id=>{calls.push(['account',id]);return account},async()=>({allowed}),
  async(_pool,id)=>{calls.push(['evidence',id]);if(failRead)throw Error('private-storage-detail');return comparisons},
  ()=>({}),()=>'',async input=>{calls.push(['pdf',input.clientId]);return new Response('synthetic-pdf',{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename=report.pdf'}})}];
 return {get:new Function(...names,source+';return GET;')(...values),calls};
}
function checkPrivate(response){
 assert.equal(response.headers.get('cache-control'),'private, no-store, max-age=0');
 assert.equal(response.headers.get('pragma'),'no-cache');
 assert.equal(response.headers.get('vary'),'Cookie');
}
test('PDF errors cannot be cached and stop at the correct authorization boundary',async()=>{
 for(const [config,status,expectedCalls] of [
  [{session:null},401,[]],
  [{account:null},404,[['account','own-client']]],
  [{allowed:false},403,[['account','own-client']]],
  [{},409,[['account','own-client'],['evidence','own-client']]],
  [{failRead:true},500,[['account','own-client'],['evidence','own-client']]],
 ]){
  const {get,calls}=handler(config);const response=await get(new Request('https://app.example/api/client-portal/report'));
  assert.equal(response.status,status);checkPrivate(response);assert.deepEqual(calls,expectedCalls);
  assert.ok(!(await response.text()).includes('private-storage-detail'));
 }
});
test('PDF success and download use the session identity and remain private',async()=>{
 for(const download of [false,true]){
  const {get,calls}=handler({comparisons:[{clientId:'own-client',results:[]}]});
  const response=await get(new Request('https://app.example/api/client-portal/report?clientId=other-client'+(download?'&download=1':'')));
  assert.equal(response.status,200);checkPrivate(response);
  assert.equal(response.headers.get('content-type'),'application/pdf');
  assert.match(response.headers.get('content-disposition'),download?/^attachment;/:/^inline;/);
  assert.deepEqual(calls,[['account','own-client'],['evidence','own-client'],['pdf','own-client']]);
 }
});
