import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {inspectPortalReaderPrivileges,portalReaderRequiredTables} from '../lib/portal-role-readiness.mjs';
import {inspectCredentialReaderPrivileges} from '../lib/credential-role-readiness.mjs';

const a='11111111-1111-4111-8111-111111111111';
const b='22222222-2222-4222-8222-222222222222';

// This tests actual PostgreSQL SELECT permissions + tenant-bound SQL with synthetic
// records; it does NOT issue sessions, authenticate a real customer or deploy roles.
test('isolated login/portal roles read different data, with two synthetic tenants',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`
   CREATE TABLE public.clients(id UUID PRIMARY KEY, name TEXT NOT NULL);
   CREATE TABLE public.client_credentials(client_id UUID REFERENCES public.clients(id),email TEXT UNIQUE,password_hash TEXT);
   CREATE TABLE public.ai_provider_comparisons(client_id UUID REFERENCES public.clients(id), query TEXT,results JSONB,created_at TIMESTAMPTZ DEFAULT NOW());
  `);
  for(const name of portalReaderRequiredTables.filter(x=>!['clients','ai_provider_comparisons'].includes(x)))
   await db.exec('CREATE TABLE public.'+name+'(id UUID PRIMARY KEY)');
  await db.query('INSERT INTO public.clients(id,name) VALUES($1,$2),($3,$4)',[a,'Synthetic A',b,'Synthetic B']);
  await db.query('INSERT INTO public.client_credentials(client_id,email,password_hash) VALUES($1,$2,$3),($4,$5,$6)',[
   a,'tenant-a@example.test','synthetic-hash-a',b,'tenant-b@example.test','synthetic-hash-b'
  ]);
  await db.query(`INSERT INTO public.ai_provider_comparisons(client_id,query,results) VALUES
   ($1,'Synthetic A question','[]'::jsonb),($2,'Synthetic B question','[]'::jsonb)`,[a,b]);
  await db.exec(`CREATE ROLE test_login_reader LOGIN;
   CREATE ROLE test_portal_reader LOGIN;
   REVOKE ALL ON public.client_credentials FROM PUBLIC;
   GRANT USAGE ON SCHEMA public TO test_login_reader,test_portal_reader;
   GRANT SELECT ON public.client_credentials TO test_login_reader;
   GRANT SELECT ON ${portalReaderRequiredTables.map(t=>'public.'+t).join(',')} TO test_portal_reader;`);
  await db.exec('SET ROLE test_login_reader');
  assert.equal((await inspectCredentialReaderPrivileges(db)).ready,true);
  assert.equal((await inspectPortalReaderPrivileges(db)).ready,false);
  const identity=(await db.query(`SELECT client_id,email,password_hash
   FROM public.client_credentials WHERE lower(email)=lower($1) LIMIT 1`,['tenant-a@example.test'])).rows[0];
  assert.equal(identity.client_id,a);
  assert.equal(identity.password_hash,'synthetic-hash-a');
  await assert.rejects(db.query('SELECT * FROM public.ai_provider_comparisons'),/permission denied/i);
  await assert.rejects(db.query('SELECT * FROM public.clients'),/permission denied/i);
  await db.exec('RESET ROLE');
  await db.exec('SET ROLE test_portal_reader');
  assert.equal((await inspectPortalReaderPrivileges(db)).ready,true);
  assert.equal((await inspectCredentialReaderPrivileges(db)).ready,false);
  const account=(await db.query('SELECT name FROM public.clients WHERE id=$1',[identity.client_id])).rows[0];
  const report=(await db.query(`SELECT client_id,query FROM public.ai_provider_comparisons
    WHERE client_id=$1 ORDER BY created_at DESC LIMIT 20`,[identity.client_id])).rows;
  assert.equal(account.name,'Synthetic A');
  assert.equal(report.length,1);
  assert.equal(report[0].query,'Synthetic A question');
  assert.equal(report[0].client_id,a);
  const other=(await db.query(`SELECT client_id,query FROM public.ai_provider_comparisons
    WHERE client_id=$1`,[b])).rows;
  assert.equal(other.length,1);
  // SELECT privileges alone do not enforce tenant isolation at database level.
  // Route/session must bind a trusted clientId; RLS acceptance is separate.
  await assert.rejects(db.query('SELECT password_hash FROM public.client_credentials'),/permission denied/i);
  await assert.rejects(db.query('UPDATE public.clients SET name=$1 WHERE id=$2',['unauthorized',a]),/permission denied/i);
  await db.exec('RESET ROLE');
 }finally{await db.close()}
});
