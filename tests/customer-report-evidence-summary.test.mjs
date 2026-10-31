import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=(await readFile(new URL('../app/api/client-portal/route.js',import.meta.url),'utf8')).replace(/^import .*;$/gm,'').replace(/export /g,'');
function fixture({session={clientId:'own'},allowed=true,fails=false}={}){
 const reads=[];
 const get=new Function('cookies','verifyClientToken','getClientAccount','customerAccess','getClientProfile','resolveRequestLanguage','SERVICE_CODES','servicePrice','formatMoney','readCustomerComparisonReport','databasePool','getDatabaseUrl',source+';return GET')(
  async()=>({get:()=>({value:'fixture'})}),async()=>session,async()=>({client:{id:'own'},scans:[]}),async()=>({allowed}),async()=>null,()=> 'tr',[],()=>null,()=>'',async(_pool,id)=>{reads.push(id);if(fails)throw Error('PRIVATE');return [{clientId:id,query:'PRIVATE',results:[]}]},()=>({}),()=> 'fixture');
 return {get,reads};
}
test('portal exposes only own report readiness, never answer payloads',async()=>{
 const f=fixture(),r=await f.get(new Request('https://example.com/api/client-portal?clientId=other')),data=await r.json();
 assert.equal(r.status,200);assert.deepEqual(f.reads,['own']);assert.deepEqual(data.account.reportEvidence,{available:true,comparisonCount:1});
 assert.doesNotMatch(JSON.stringify(data),/PRIVATE/);assert.match(r.headers.get('cache-control'),/private.*no-store/);
});
test('evidence read failure does not break portal or claim readiness; access rejection prevents reads',async()=>{
 const f=fixture({fails:true}),r=await f.get(new Request('https://example.com/api/client-portal'));assert.equal(r.status,200);
 assert.deepEqual((await r.json()).account.reportEvidence,{available:false,comparisonCount:0});
 for(const options of [{session:null},{allowed:false}]){const denied=fixture(options);assert.ok((await denied.get(new Request('https://example.com/api/client-portal'))).status>=400);assert.deepEqual(denied.reads,[])}
});
