import {permissionEnquiry,safeFirstContact} from "../lib/outreach-quality.js";
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=(await readFile(new URL('../app/api/communication-send/route.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replace(/export /g,'');
function fixture(from='AI Visibility <hello@example.com>'){
 const state={calls:0,mail:null};
 const x={id:'p',name:'Example Business',country:'Germany',contactEmail:'public@example.org',communicationStatus:'ready-for-review',contactStatus:'verified',outreachDraft:'Existing draft'};
 const api=new Function('requireAdmin','enforceSameOrigin','getCommunicationProspect','markProspectCommunicationSent','sendBrandedOutreach','process','permissionEnquiry','safeFirstContact',source+'\nreturn {GET,POST};')(async()=>null,()=>null,async()=>x,async()=>({communicationStatus:'sent'}),async(mail,{finalize})=>{state.calls++;state.mail=mail;await finalize('provider-123');return{id:'provider-123'}},{env:{RESEND_API_KEY:'not-returned',RESEND_FROM_EMAIL:from}},permissionEnquiry,safeFirstContact);
 return {api,state};
}
const request=draft=>new Request('https://example.com/api/communication-send',{method:'POST',body:JSON.stringify({prospectId:'p',draft})});
test('test sender cannot send to prospects and sender response never exposes credentials',async()=>{
 const {api,state}=fixture('onboarding@resend.dev');const status=await(await api.GET(request())).json();assert.equal(status.configured,false);assert.doesNotMatch(JSON.stringify(status),/not-returned/);assert.equal((await api.POST(request('An approved first contact message for the business.'))).status,409);assert.equal(state.calls,0);
});
test('stale and edited unsupported claims rejected; exact permission enquiry delivered',async()=>{
 const {api,state}=fixture();assert.equal((await api.POST(request('too short'))).status,400);assert.equal(state.calls,0);assert.equal((await api.POST(request('Your AI visibility score is 25/100 and you have no Google profile.'))).status,409);assert.equal(state.calls,0);const draft=permissionEnquiry({name:'Example Business',country:'Germany'});const r=await api.POST(request(draft));assert.equal(r.status,200);assert.equal(state.mail.outreachDraft,draft);assert.equal(state.calls,1);
});
test('delivery lookup only queries locally recorded sends and reports provider events without resending',async()=>{
 const id='01a11278-c210-7176-bc7f-0196dec182ec';let reads=0;
 const api=new Function('requireAdmin','enforceSameOrigin','databasePool','getDatabaseUrl','fetch','process',source+'\nreturn {GET,POST};')(
  async()=>null,()=>null,()=>({query:async(sql,params)=>({rows:params?.[0]===id?[{provider_id:id}]:[]})}),()=>'',async()=>{reads++;return Response.json({id,last_event:'delivered'})},{env:{RESEND_API_KEY:'private'}});
 const request=id=>new Request('https://example.com/api/communication-send',{method:'POST',body:JSON.stringify({action:'delivery-status',emailId:id})});
 assert.equal((await api.POST(request('01a11278-c210-7176-bc7f-0196dec182ed'))).status,404);assert.equal(reads,0);
 const response=await api.POST(request(id));assert.equal(response.status,200);assert.deepEqual(await response.json(),{id,verified:true,event:'delivered'});assert.equal(reads,1);
});

test('delivery reads use the existing receiving credential and expose permission errors without false delivery',async()=>{
 const id='01a11278-c210-7176-bc7f-0196dec182ec';let authorization;
 const api=new Function('requireAdmin','enforceSameOrigin','databasePool','getDatabaseUrl','fetch','process',source+'\nreturn {GET,POST};')(async()=>null,()=>null,()=>({query:async()=>({rows:[{provider_id:id}]})}),()=>'',async(url,options)=>{authorization=options.headers.authorization;return new Response('',{status:403})},{env:{RESEND_API_KEY:'send-only',RESEND_RECEIVING_API_KEY:'existing-read-key'}});
 const response=await api.POST(new Request('https://example.com/api/communication-send',{method:'POST',body:JSON.stringify({action:'delivery-status',emailId:id})}));
 assert.equal(authorization,'Bearer existing-read-key');assert.equal(response.status,200);const data=await response.json();assert.equal(data.verified,false);assert.equal(data.providerStatus,403);assert.equal(data.code,'read-access-required');assert.equal(data.event,undefined);assert.doesNotMatch(JSON.stringify(data),/existing-read-key|send-only/);
});

test('omitting a draft uses the safe permission enquiry instead of a stale stored claim',async()=>{
 const {api,state}=fixture();assert.equal((await api.POST(request())).status,200);assert.equal(state.mail.outreachDraft,permissionEnquiry({name:'Example Business',country:'Germany'}));assert.doesNotMatch(state.mail.outreachDraft,/Existing draft/);
});
