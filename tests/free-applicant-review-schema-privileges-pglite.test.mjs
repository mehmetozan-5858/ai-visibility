import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

// Execute actual reviewed migrations in an isolated PostgreSQL engine.
// This does not prove production service-role grants or real customer access.
test('reviewed free proof and applicant consent tables are RLS-enabled and have no default public grants',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`CREATE TABLE public.customer_leads(id uuid PRIMARY KEY);
  CREATE TABLE public.prospects(id uuid PRIMARY KEY);`);
  for(const filename of ['free-applicant-verified-proof-review.sql','applicant-free-provider-consents-review.sql'])
   await db.exec(await readFile(new URL('../migrations/'+filename,import.meta.url),'utf8'));
  const rows=(await db.query(`SELECT c.relname,c.relrowsecurity,
   COALESCE(bool_or(a.grantee=0 AND a.privilege_type IN ('SELECT','INSERT','UPDATE','DELETE')),false) AS public_data_grant
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   LEFT JOIN LATERAL aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) a ON true
   WHERE n.nspname='public' AND c.relname = ANY($1::text[])
   GROUP BY c.relname,c.relrowsecurity ORDER BY c.relname`,[[
    'free_applicant_verified_receipts','free_applicant_verified_observations',
    'applicant_free_provider_consents'
   ]])).rows;
  assert.equal(rows.length,3);
  assert.ok(rows.every(x=>x.relrowsecurity===true && x.public_data_grant===false),
   JSON.stringify(rows));
 }finally{await db.close();}
});
