import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {comparisonReportRows} from '../lib/customer-comparison-report.mjs';

// REVIEW ONLY: no live customer read. Strict portal returns historical rows
// only after signed session, entitlement, narrow reader and RLS checks.
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
test('portal only exposes historical preview after strict reader and RLS checks',async()=>{
 const source=await read('app/api/client-portal/route.js');
 const strict=source.indexOf("if(process.env.PORTAL_TENANT_RLS_ENABLED==='true')");
 const legacy=source.indexOf('}else{',strict);
 const body=source.slice(strict,legacy);
 const entitlement=body.indexOf('strictReportEntitlementReady');
 const role=body.indexOf('inspectPortalReaderPrivileges(reader)');
 const rls=body.indexOf('inspectComparisonRlsPolicy(reader)');
 const verifiedRead=body.indexOf('withVerifiedClientTenantRead(reader');
 const preview=body.indexOf("reportPreview={evidenceClass:'historical'");
 assert.ok(strict>=0&&entitlement>=0&&role>entitlement&&rls>role&&
  verifiedRead>rls&&preview>verifiedRead,'preview must follow strict gates');
 assert.equal(source.slice(legacy).includes('reportPreview={'),false,
  'legacy broad-reader path must never disclose preview');
 assert.match(body,/verifiedProviderEvidence:false/);
 assert.match(source,/"Cache-Control":"private, no-store, max-age=0"/);
 assert.match(source,/reportPreview,language/);
});
test('historical preview projection excludes foreign tenants and unverified receipt claims',()=>{
 const raw=[
  {clientId:B,query:'foreign secret',results:[{provider:'gemini',status:'source-supported-answer',
   verified:true,answer:'foreign secret'}]},
  {clientId:A,query:'Synthetic query',createdAt:'2026-11-15T00:00:00Z',
   results:[{provider:'gemini',status:'answer-received-unverified',
    verified:false,answer:'Synthetic answer',providerEvidence:{status:'receipt-cost-zero'},
    secret:'should-not-leak'}, {provider:'unknown-paid',status:'source-supported-answer',
    verified:true,answer:'not-allowlisted'}]}
 ];
 const rows=comparisonReportRows(raw,A);
 assert.equal(rows.length,1);
 assert.equal(rows[0].clientId,A);
 assert.equal(rows[0].results.length,1);
 assert.equal(rows[0].results[0].verified,false);
 assert.equal(rows[0].results[0].supported,false);
 assert.equal(rows[0].results[0].evidence,null);
 assert.equal(JSON.stringify(rows).includes('foreign secret'),false);
 assert.equal(JSON.stringify(rows).includes('should-not-leak'),false);
 assert.equal(JSON.stringify(rows).includes('receipt-cost-zero'),false);
});
