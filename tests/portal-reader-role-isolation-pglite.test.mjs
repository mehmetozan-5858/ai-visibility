import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';

// Synthetic isolated PostgreSQL roles. No production role or GRANT changes.
// Login credential verification and read-only portal reporting MUST use separate privileges.
test('portal reader can SELECT only scoped report tables, not credentials or writes',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`
   CREATE TABLE public.clients(id UUID PRIMARY KEY, status TEXT);
   CREATE TABLE public.scans(id UUID PRIMARY KEY, client_id UUID);
   CREATE TABLE public.client_activity(id UUID PRIMARY KEY, client_id UUID);
   CREATE TABLE public.work_items(id UUID PRIMARY KEY, client_id UUID);
   CREATE TABLE public.payments(id UUID PRIMARY KEY, client_id UUID);
   CREATE TABLE public.client_profiles(client_id UUID PRIMARY KEY);
   CREATE TABLE public.client_pilot_access(client_id UUID PRIMARY KEY);
   CREATE TABLE public.findings(id UUID PRIMARY KEY, client_id UUID);
   CREATE TABLE public.client_credentials(client_id UUID PRIMARY KEY, password_hash TEXT);
   CREATE ROLE isolated_portal_reader NOLOGIN;
   REVOKE ALL ON TABLE public.client_credentials FROM PUBLIC;
   GRANT USAGE ON SCHEMA public TO isolated_portal_reader;
   GRANT SELECT ON public.clients,public.scans,public.client_activity,
    public.work_items,public.payments,public.client_profiles,
    public.client_pilot_access,public.findings TO isolated_portal_reader;
  `);
  const rows=(await db.query(`SELECT
    has_table_privilege('isolated_portal_reader','public.clients','SELECT') AS client_read,
    has_table_privilege('isolated_portal_reader','public.payments','SELECT') AS payment_read,
    has_table_privilege('isolated_portal_reader','public.client_credentials','SELECT') AS credential_read,
    has_table_privilege('isolated_portal_reader','public.findings','INSERT') AS findings_write,
    has_table_privilege('isolated_portal_reader','public.client_profiles','UPDATE') AS profile_write`)).rows[0];
  assert.equal(rows.client_read,true);
  assert.equal(rows.payment_read,true);
  assert.equal(rows.credential_read,false);
  assert.equal(rows.findings_write,false);
  assert.equal(rows.profile_write,false);
  await db.exec('SET ROLE isolated_portal_reader');
  assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM public.clients')).rows[0].n,0);
  await assert.rejects(db.query('SELECT password_hash FROM public.client_credentials'),/permission denied/i);
  await assert.rejects(db.query("INSERT INTO public.clients VALUES('11111111-1111-4111-8111-111111111111','active')"),/permission denied/i);
  await assert.rejects(db.exec('CREATE TABLE public.forbidden_ddl(id INT)'),/permission denied/i);
  await db.exec('RESET ROLE');
 }finally{await db.close()}
});
