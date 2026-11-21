import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {repeatEvidenceOptions} from '../lib/answer-evidence-comparison.js';
const source=(await readFile(new URL('../lib/answer-evidence-automation.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replace(/export /g,'');
const {chooseAutomaticEvidence,runAutomaticAnswerEvidence}=new Function('repeatEvidenceOptions','selectScheduledFreePilot',source+';return {chooseAutomaticEvidence,runAutomaticAnswerEvidence};')(repeatEvidenceOptions,async()=>null);
const entity={id:'old',name:'Acme Precision',domain:'acme.com',sector:'machining',city:'Berlin'};
const result={queries:['Suggest machining providers in Berlin.'],observations:[{provider:'Perplexity',model:'fixture',mode:'agent-api',brandPrompted:false,truncated:false}],errors:[],summary:{neutralComplete:1}};
const run={id:'old-run',entityId:'old',entityType:'prospect',entityName:entity.name,domain:entity.domain,result};
const due=[{entity,run}],fresh=[{...entity,id:'new',name:'New Company',domain:'new.com'}],providers=['Perplexity'];
test('automatic capacity alternates first observations and overdue single-query repeats',()=>{assert.equal(chooseAutomaticEvidence({due,fresh,providers,slot:2}).kind,'first');const selected=chooseAutomaticEvidence({due,fresh,providers,slot:3});assert.equal(selected.kind,'repeat');assert.deepEqual(selected.options.queries,result.queries);assert.deepEqual(selected.options.providers,['Perplexity']);assert.equal(selected.options.automaticRepeat,true);assert.equal(chooseAutomaticEvidence({due,fresh:[],providers,slot:2}).kind,'repeat');assert.equal(chooseAutomaticEvidence({due:[],fresh,providers,slot:3}).kind,'first')});
test('changed identities, unavailable providers, prompted/partial and multi-call baselines cannot be scheduled',()=>{for(const modified of [{...run,entityName:'Changed'},{...run,result:{...result,queries:[...result.queries,'Another valid query?']}},{...run,result:{...result,observations:[{...result.observations[0],truncated:true}]}},{...run,result:{...result,observations:[{...result.observations[0],brandPrompted:true}]}}])assert.equal(chooseAutomaticEvidence({due:[{entity,run:modified}],providers,slot:3}),null);assert.equal(chooseAutomaticEvidence({due,providers:['Gemini'],slot:3}),null);assert.equal(chooseAutomaticEvidence({fresh:[{...entity,sector:''}],providers}),null)});
function fixture({available=true,fail=false,auditFail=false}={}){const state={claimed:false,calls:[],measured:[]};const pool={query:async(sql,p)=>{state.calls.push({sql,p});if(sql.includes('FROM (SELECT DISTINCT'))return {rows:[{...entity,runId:run.id,entityName:run.entityName,runDomain:run.domain,result,createdAt:'2026-10-06T10:00:00Z'}]};if(sql.includes('EXTRACT(EPOCH'))return {rows:[{hour:3}]};if(sql.startsWith('INSERT')){if(!available||state.claimed)return {rows:[]};state.claimed=true;return {rows:[{slot:'hour-3'}]}};if(sql.startsWith('UPDATE')&&auditFail)throw Error('audit-failed');return {rows:[]}}};const deps={clientPlans:async()=>[],pool,providers:()=>providers,guard:async()=>({mode:'normal'}),measure:async(e,o)=>{state.measured.push({e,o});if(fail)throw Error('provider-failed');return {id:'saved',result:{...result,comparison:{pairs:[{}]}}}}};return {state,deps}}
test('database hour claim allows only one automatic call across repeats and reruns',async()=>{const f=fixture();const first=await runAutomaticAnswerEvidence(fresh,f.deps);assert.equal(first.kind,'repeat');assert.equal(first.id,'saved');assert.equal(first.slotAuditSaved,true);assert.equal(f.state.measured.length,1);assert.equal(f.state.measured[0].o.repeatRunId,'old-run');const second=await runAutomaticAnswerEvidence(fresh,f.deps);assert.equal(second.skipped,'hourly-evidence-slot-used');assert.equal(f.state.measured.length,1);const sql=f.state.calls.find(x=>x.sql.includes('FROM (SELECT DISTINCT')).sql;assert.match(sql,/24 hours/);assert.match(sql,/NOT EXISTS\(SELECT 1 FROM answer_evidence_automation_slots/);assert.match(sql,/client_id IS NULL/);assert.match(sql,/LIMIT 20/)});
test('claimed failures consume the hour and saved evidence survives slot audit failure',async()=>{const f=fixture({fail:true});await assert.rejects(()=>runAutomaticAnswerEvidence([],f.deps));assert.ok(f.state.calls.some(x=>x.sql.includes("status='failed'")));assert.equal((await runAutomaticAnswerEvidence([],f.deps)).skipped,'hourly-evidence-slot-used');assert.equal(f.state.measured.length,1);const g=fixture({auditFail:true});const r=await runAutomaticAnswerEvidence([],g.deps);assert.equal(r.id,'saved');assert.equal(r.slotAuditSaved,false)});
test('emergency guard or missing providers cannot spend an automatic call',async()=>{const f=fixture();f.deps.guard=async()=>({mode:'emergency'});assert.equal((await runAutomaticAnswerEvidence([],f.deps)).skipped,'ai-budget-exhausted');assert.equal(f.state.calls.length,0);f.deps.guard=async()=>({mode:'normal'});f.deps.providers=()=>[];assert.equal((await runAutomaticAnswerEvidence([],f.deps)).skipped,'provider-unavailable');assert.equal(f.state.measured.length,0)});
test('customer followup shares the single hourly claim and gets a reserved turn without extra capacity',async()=>{const f=fixture();f.deps.clientPlans=async()=>[{entity:{id:'customer',entityType:'client',name:'Paid Customer'},kind:'repeat',options:{queries:['Suggest machining providers in Berlin.'],providers:['Perplexity'],automaticRepeat:true,implementationWorkId:'work'}}];const r=await runAutomaticAnswerEvidence(fresh,f.deps);assert.equal(r.entityType,'client');assert.equal(f.state.measured.length,1);assert.equal(f.state.measured[0].e.id,'customer');assert.equal(f.state.calls.find(x=>x.sql.startsWith('INSERT')).p[2],'client');assert.equal((await runAutomaticAnswerEvidence(fresh,f.deps)).skipped,'hourly-evidence-slot-used');assert.equal(f.state.measured.length,1)});

test('scheduled pilot uses the shared hourly claim and only its free collector', async () => {
 const f=fixture();
 const collect=async()=>({measurementPolicy:'verified-zero-price-only'});
 const pilot={entity:{...entity,entityType:'client'},kind:'pilot-first',options:{automationKind:'pilot-first',measurementOrigin:'scheduler'},collect};
 f.deps.pilotPlan=async()=>pilot;
 f.deps.providers=()=>{throw Error('paid providers must not be initialized for pilot');};
 f.deps.measure=async(e,o,deps)=>{
  assert.equal(e.entityType,'client');
  assert.equal(o.measurementOrigin,'scheduler');
  assert.equal(deps.collect,collect);
  return {id:'pilot-run',result:await deps.collect()};
 };
 const run=await runAutomaticAnswerEvidence([],f.deps);
 assert.equal(run.kind,'pilot-first');
 assert.equal(run.result.measurementPolicy,'verified-zero-price-only');
 assert.equal((await runAutomaticAnswerEvidence([],f.deps)).skipped,'hourly-evidence-slot-used');
});

test('pilot selection checks active access, attempt cooldown, and a previously usable scheduled result in PostgreSQL',async()=>{
 const {PGlite}=await import('@electric-sql/pglite');
 const {selectScheduledFreePilot}=await import('../lib/scheduled-free-pilot.mjs');
 const db=new PGlite();
 const id='10000000-0000-0000-0000-000000000001';
 const env={SCHEDULED_FREE_PILOT_CLIENT_ID:id,SCHEDULED_FREE_PILOT_MODEL:'test/model:free',APPLICANT_FREE_MEASUREMENT_ENABLED:'true',OPENROUTER_API_KEY:'fixture'};
 try{
  assert.equal(await selectScheduledFreePilot(db,env),null);
  await db.exec(`CREATE TABLE clients(id uuid,name text,domain text,status text);
   CREATE TABLE client_profiles(client_id uuid,sector text,city text,country text);
   CREATE TABLE client_pilot_access(client_id uuid,revoked_at timestamptz,expires_at timestamptz);
   CREATE TABLE answer_evidence_automation_slots(entity_id uuid,entity_type text,kind text,created_at timestamptz);
   CREATE TABLE answer_evidence_runs(entity_id uuid,entity_type text,result jsonb)`);
  await db.query("INSERT INTO clients VALUES($1,'Fixture Brand','','active')",[id]);
  await db.query("INSERT INTO client_profiles VALUES($1,'clothing','Wetzlar','Germany')",[id]);
  await db.query("INSERT INTO client_pilot_access VALUES($1,NULL,NOW()+INTERVAL '1 day')",[id]);
  assert.equal((await selectScheduledFreePilot(db,env)).entity.id,id);
  await db.query("INSERT INTO answer_evidence_automation_slots VALUES($1,'client','pilot-first',NOW())",[id]);
  assert.equal(await selectScheduledFreePilot(db,env),null);
  await db.query("UPDATE answer_evidence_automation_slots SET created_at=NOW()-INTERVAL '2 days'");
  await db.query("INSERT INTO answer_evidence_runs VALUES($1,'client',$2)",[id,{automationKind:'pilot-first',measurementPolicy:'verified-zero-price-only',observations:null}]);
  assert.ok(await selectScheduledFreePilot(db,env));
  await db.query("UPDATE answer_evidence_runs SET result=$1",[{automationKind:'pilot-first',measurementPolicy:'verified-zero-price-only',observations:[{
   provider:'OpenRouter',mode:'openrouter-free-api-no-search',model:'test/model:free',responseId:'response',usage:{cost:{total_cost:0}},
   truncated:false,brandPrompted:false,query:'Which stores sell clothing?',text:'Fixture response',
  }]}]);
  assert.equal(await selectScheduledFreePilot(db,env),null);
  await db.exec("DELETE FROM answer_evidence_runs; UPDATE client_pilot_access SET revoked_at=NOW()");
  assert.equal(await selectScheduledFreePilot(db,env),null);
 }finally{await db.close();}
});
