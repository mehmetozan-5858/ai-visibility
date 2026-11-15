import test from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {grantPilotWithLockReview,revokePilotWithLockReview}
 from '../lib/portal-pilot-writes-review.mjs';

// Disposable PostgreSQL 16 GitHub CI service ONLY: never use a Neon, customer,
// production or remotely-provided URL. Synthetic tenants and audit events.
// This is a SQL writer acceptance probe, not a real customer-path release test.
const url=process.env.PORTAL_LOCK_RACE_DATABASE_URL;
const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
test('real PostgreSQL pilot writer commits grant/revoke and rolls back failed audit',{
 skip:!url?'requires disposable CI PostgreSQL service':false,timeout:25000
},async()=>{
 const db=new Pool({connectionString:url,max:3,connectionTimeoutMillis:2500});
 try{
  await db.query('CREATE TABLE public.client_pilot_access (client_id uuid PRIMARY KEY,email text NOT NULL,reason text NOT NULL,expires_at timestamptz NOT NULL,revoked_at timestamptz)');
  await db.query('CREATE TABLE public.client_activity (id uuid PRIMARY KEY,client_id uuid NOT NULL,event_type text NOT NULL,title text NOT NULL,detail text NOT NULL,metadata jsonb NOT NULL,CONSTRAINT test_deny_bad_grant CHECK (client_id <> \'22222222-2222-4222-8222-222222222222\'::uuid OR event_type <> \'pilot-granted\'))');

  // An audit failure must roll back the grant itself; no partially active pilot.
  await assert.rejects(grantPilotWithLockReview(db,B,'synthetic@example.com',7,'Synthetic pilot audit failure'));
  const denied=(await db.query('SELECT 1 FROM public.client_pilot_access WHERE client_id=$1',[B])).rows;
  assert.equal(denied.length,0);
  assert.equal((await db.query('SELECT 1 FROM public.client_activity WHERE client_id=$1',[B])).rows.length,0);

  assert.deepEqual(await grantPilotWithLockReview(db,A,'SYNTHETIC@example.com',7,'Synthetic report pilot'),{granted:true});
  let state=(await db.query('SELECT email,revoked_at,expires_at>clock_timestamp() AS valid FROM public.client_pilot_access WHERE client_id=$1',[A])).rows;
  assert.equal(state.length,1);
  assert.equal(state[0].email,'synthetic@example.com');
  assert.equal(state[0].revoked_at,null);
  assert.equal(state[0].valid,true);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM public.client_activity WHERE client_id=$1 AND event_type='pilot-granted'",[A])).rows[0].n,1);

  assert.deepEqual(await revokePilotWithLockReview(db,A),{revoked:true});
  state=(await db.query('SELECT revoked_at FROM public.client_pilot_access WHERE client_id=$1',[A])).rows;
  assert.ok(state[0].revoked_at,'revoked pilot must be marked in committed SQL');
  assert.equal((await db.query("SELECT count(*)::int AS n FROM public.client_activity WHERE client_id=$1 AND event_type='pilot-revoked'",[A])).rows[0].n,1);
  assert.deepEqual(await revokePilotWithLockReview(db,A),{revoked:false});
  assert.equal((await db.query("SELECT count(*)::int AS n FROM public.client_activity WHERE client_id=$1 AND event_type='pilot-revoked'",[A])).rows[0].n,1);
 }finally{
  await db.query('DROP TABLE IF EXISTS public.client_activity').catch(()=>{});
  await db.query('DROP TABLE IF EXISTS public.client_pilot_access').catch(()=>{});
  await db.end();
 }
});
