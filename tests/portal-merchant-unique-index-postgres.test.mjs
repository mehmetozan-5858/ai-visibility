import test from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';

const source=process.env.PORTAL_LOCK_RACE_DATABASE_URL;
if(source){
 const u=new URL(source);
 if(!['postgres:','postgresql:'].includes(u.protocol)||
   !['localhost','127.0.0.1'].includes(u.hostname)||
   u.pathname!=='/fixture'||decodeURIComponent(u.username)!=='fixture')
  throw Error('disposable-local-postgres-only');
}
const migration=new URL('../migrations/portal-merchant-reference-unique-index-review.sql',import.meta.url);
test('normalized merchant reference index rejects collision instead of choosing arbitrary payment',{
 skip:!source?'requires disposable local PostgreSQL fixture':false,timeout:20000
},async()=>{
 const u=new URL(source);
 const dbName='ci_merchant_oid_'+randomUUID().replaceAll('-','').slice(0,12);
 const admin=new Pool({connectionString:source,max:1,connectionTimeoutMillis:3000,query_timeout:8000});
 let pool,created=false;
 try{
  await admin.query('CREATE DATABASE '+dbName);created=true;
  u.pathname='/'+dbName;
  pool=new Pool({connectionString:u.toString(),max:2,connectionTimeoutMillis:3000,query_timeout:8000});
  await pool.query('CREATE TABLE public.payments (id uuid PRIMARY KEY, reference_code text NOT NULL UNIQUE)');
  const id1=randomUUID(),id2=randomUUID();
  await pool.query('INSERT INTO public.payments(id,reference_code) VALUES($1,$2),($3,$4)',
   [id1,'AB-CD-12345678',id2,'ABC-D12345678']);
  const migrationText=await readFile(migration,'utf8');
  await assert.rejects(pool.query(migrationText),e=>e.code==='23505',
   'colliding normalized references must block unique index creation');
  const noIndex=await pool.query("SELECT to_regclass('public.payments_merchant_oid_normalized_unique_review') AS idx");
  assert.equal(noIndex.rows[0].idx,null,'failed install cannot be mistaken for success');
  await pool.query('DELETE FROM public.payments WHERE id=$1',[id2]);
  await pool.query(migrationText);
  await assert.rejects(pool.query('INSERT INTO public.payments(id,reference_code) VALUES($1,$2)',
   [randomUUID(),'A-BCD12345678']),e=>e.code==='23505',
   'new normalized duplicate must be refused after index exists');
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM public.payments')).rows[0].n,1);
 }finally{
  if(pool)await pool.end().catch(()=>{});
  if(created)await admin.query('DROP DATABASE '+dbName).catch(()=>{});
  await admin.end();
 }
});
