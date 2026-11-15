import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('PDF and portal preview both enforce signed tenant reader and RLS in strict mode',async()=>{
 const pdf=await read('app/api/client-portal/report/route.js');
 const portal=await read('app/api/client-portal/route.js');
 for(const source of [pdf,portal]){
  assert.match(source,/PORTAL_TENANT_RLS_ENABLED==='true'/);
  assert.match(source,/strictReportEntitlementReady\(access,strictCustomerSettlementEnabled\(\)\)/);
  assert.match(source,/portalReadDatabaseEnabled\(\)/);
  assert.match(source,/inspectPortalReaderPrivileges\(reader\)/);
  assert.match(source,/inspectComparisonRlsPolicy\(reader\)/);
  assert.match(source,/withVerifiedClientTenantRead\(reader/);
 }
 const strict=pdf.indexOf("if(process.env.PORTAL_TENANT_RLS_ENABLED==='true')");
 const fallback=pdf.indexOf('}else{',strict);
 const privateRead=pdf.indexOf('withVerifiedClientTenantRead(reader',strict);
 assert.ok(strict>=0&&privateRead>strict&&fallback>privateRead);
 assert.equal(pdf.slice(strict,fallback).includes('databasePool(getDatabaseUrl())'),false,
  'strict PDF cannot read using broad writer pool');
 assert.match(pdf,/"Cache-Control":"private, no-store, max-age=0"/);
 assert.match(pdf,/return privateJson\(\{error:"Güvenli müşteri raporu yüklenemedi."\},503\)/);
});
