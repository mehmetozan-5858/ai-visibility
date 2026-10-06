import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=(await readFile(new URL('../app/api/communication-send/route.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replace(/export /g,'');
function fixture(from='AI Visibility <hello@example.com>'){
 const state={calls:0,mail:null};
 const x={id:'p',contactEmail:'public@example.org',communicationStatus:'ready-for-review',contactStatus:'verified',outreachDraft:'Existing draft'};
 const api=new Function('requireAdmin','enforceSameOrigin','getCommunicationProspect','markProspectCommunicationSent','sendBrandedOutreach','process',source+'\nreturn {GET,POST};')(async()=>null,()=>null,async()=>x,async()=>({communicationStatus:'sent'}),async(mail,{finalize})=>{state.calls++;state.mail=mail;await finalize('provider-123');return{id:'provider-123'}},{env:{RESEND_API_KEY:'not-returned',RESEND_FROM_EMAIL:from}});
 return {api,state};
}
const request=draft=>new Request('https://example.com/api/communication-send',{method:'POST',body:JSON.stringify({prospectId:'p',draft})});
test('test sender cannot send to prospects and sender response never exposes credentials',async()=>{
 const {api,state}=fixture('onboarding@resend.dev');const status=await(await api.GET(request())).json();assert.equal(status.configured,false);assert.doesNotMatch(JSON.stringify(status),/not-returned/);assert.equal((await api.POST(request('An approved first contact message for the business.'))).status,409);assert.equal(state.calls,0);
});
test('invalid drafts are rejected and approved text is the exact delivered message',async()=>{
 const {api,state}=fixture();assert.equal((await api.POST(request('too short'))).status,400);assert.equal(state.calls,0);const draft='Hello, may we share a short AI visibility assessment with your team?';const r=await api.POST(request(draft));assert.equal(r.status,200);assert.equal(state.mail.outreachDraft,draft);assert.equal(state.calls,1);
});
test('delivery lookup only queries locally recorded sends and reports provider events without resending',async()=>{
 const id='01a11278-c210-7176-bc7f-0196dec182ec';let reads=0;
 const api=new Function('requireAdmin','enforceSameOrigin','databasePool','getDatabaseUrl','fetch','process',source+'\nreturn {GET,POST};')(
  async()=>null,()=>null,()=>({query:async(sql,params)=>({rows:params?.[0]===id?[{provider_id:id}]:[]})}),()=>'',async()=>{reads++;return Response.json({id,last_event:'delivered'})},{env:{RESEND_API_KEY:'private'}});
 const request=id=>new Request('https://example.com/api/communication-send',{method:'POST',body:JSON.stringify({action:'delivery-status',emailId:id})});
 assert.equal((await api.POST(request('01a11278-c210-7176-bc7f-0196dec182ed'))).status,404);assert.equal(reads,0);
 const response=await api.POST(request(id));assert.equal(response.status,200);assert.deepEqual(await response.json(),{id,event:'delivered'});assert.equal(reads,1);
});
