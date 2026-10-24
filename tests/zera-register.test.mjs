import test from 'node:test';import assert from 'node:assert/strict';
import {registerZeraPilot} from '../pilot/zera-register.mjs';
test('explicit approval is required for writes',async()=>{let calls=0;await assert.rejects(registerZeraPilot({find:async()=>{calls++}}),/approval/);assert.equal(calls,0)});
test('existing customer reused without creating duplicates',async()=>{
 let created=0;const r=await registerZeraPilot({approved:true,find:async()=>({id:'abc'}),add:async()=>{created++}});
 assert.equal(r.clientId,'abc');assert.equal(created,0);
});
test('persisted pilot receives separate profile; unknown website stays unknown',async()=>{
 let inserted=null,stored=null;
 const r=await registerZeraPilot({approved:true,find:async()=>null,add:async input=>{inserted=input;return {id:'abc',persisted:true}},profile:async(id,data)=>{stored=data}});
 assert.equal(r.created,true);assert.equal(inserted.domain,'');assert.equal(stored.city,'Wetzlar');
});
test('absence of database must not claim registered pilot',async()=>{
 await assert.rejects(registerZeraPilot({approved:true,find:async()=>null,add:async()=>({persisted:false})}),/Persistent database/);
});
