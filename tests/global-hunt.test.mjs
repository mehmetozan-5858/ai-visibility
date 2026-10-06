import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=(await readFile(new URL('../app/api/global-hunt/route.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replace(/export /g,'');
function fixture({denied=false,emergency=false,locked=true}={}){
 const state={runs:0,released:false,unlocked:false};
 const client={query:async sql=>{if(sql.includes('pg_advisory_unlock'))state.unlocked=true;return {rows:[{acquired:locked}]}},release(){state.released=true}};
 const hunt=async req=>{assert.equal(req.headers.get('authorization'),'Bearer private-key');state.runs++;return Response.json({ok:true,found:3,saved:2,providerErrors:[],secret:'never-return-this'})};
 const post=new Function('requireAdmin','enforceSameOrigin','checkRateLimit','databasePool','getDatabaseUrl','refreshBudgetGuard','businessHunt','creatorHunt','process',source+'\nreturn POST;')(async()=>denied?Response.json({error:'unauthorized'},{status:401}):null,()=>null,()=>null,()=>({connect:async()=>client}),()=> 'configured',async()=>({mode:emergency?'emergency':'normal'}),hunt,hunt,{env:{CRON_SECRET:'private-key'}});
 return {post,state};
}
const req=()=>new Request('https://example.com/api/global-hunt',{method:'POST'});
test('global hunt cannot run without admin or during budget exhaustion',async()=>{
 for(const options of [{denied:true},{emergency:true},{locked:false}]){const {post,state}=fixture(options);assert.ok((await post(req())).status>=400);assert.equal(state.runs,0)}
});
test('global hunt runs both discovery engines, releases lock and returns no secrets or sending permission',async()=>{
 const {post,state}=fixture();const d=await (await post(req())).json();assert.equal(state.runs,2);assert.equal(d.business.found,3);assert.equal(d.creator.saved,2);assert.equal(d.automaticSending,false);assert.equal(state.released,true);assert.equal(state.unlocked,true);assert.doesNotMatch(JSON.stringify(d),/private-key|never-return-this/);
});
