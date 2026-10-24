import test from 'node:test';import assert from 'node:assert/strict';
import {registerZeraPilot} from '../pilot/zera-register.mjs';
test('explicit approval is required for writes',async()=>{let calls=0;await assert.rejects(registerZeraPilot({find:async()=>{calls++}}),/approval/);assert.equal(calls,0)});
test('existing customer reused without creating duplicates',async()=>{
 let created=0,profiles=0;const r=await registerZeraPilot({approved:true,find:async()=>({id:'abc',name:'ZERA Clothing',domain:''}),add:async()=>{created++},profile:async()=>{profiles++}});
 assert.equal(r.clientId,'abc');assert.equal(created,0);assert.equal(profiles,1);
});
test('persisted pilot receives separate profile; unknown website stays unknown',async()=>{
 let inserted=null,stored=null;
 const r=await registerZeraPilot({approved:true,find:async()=>null,add:async input=>{inserted=input;return {id:'abc',persisted:true}},profile:async(id,data)=>{stored=data}});
 assert.equal(r.created,true);assert.equal(inserted.domain,'');assert.equal(stored.city,'Wetzlar');
});
test('absence of database must not claim registered pilot',async()=>{
 await assert.rejects(registerZeraPilot({approved:true,find:async()=>null,add:async()=>({persisted:false})}),/Persistent database/);
});

test('profile persistence failures cannot report registration success',async()=>{
 await assert.rejects(registerZeraPilot({approved:true,find:async()=>({id:'abc',name:'ZERA Clothing',domain:''}),add:async()=>{throw Error('duplicate')},profile:async()=>{throw Error('profile-write-failed')}}),/profile-write-failed/);
});

test('similar named registered website is not overwritten',async()=>{
 let profiles=0;
 await assert.rejects(registerZeraPilot({approved:true,find:async()=>({id:'other',name:'ZERA Clothing',domain:'unrelated.example'}),add:async()=>{throw Error('should not create')},profile:async()=>{profiles++}}),/manual review/);
 assert.equal(profiles,0);
});
