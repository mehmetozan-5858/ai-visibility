import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('customer displays only strict historical preview and never upgrades it to verified provider evidence',async()=>{
 const api=await read('app/api/client-portal/route.js');
 const ui=await read('components/CustomerPortal.js');
 assert.match(api,/if\(process\.env\.PORTAL_TENANT_RLS_ENABLED==='true'\)/);
 assert.match(api,/reportPreview=\{evidenceClass:'historical',verifiedProviderEvidence:false,reports:rows\}/);
 assert.match(ui,/setReportPreview\(a\.reportPreview\?\.evidenceClass==="historical"&&a\.reportPreview\.verifiedProviderEvidence===false/);
 assert.match(ui,/reportPreview\?\.evidenceClass==="historical"&&reportPreview\.verifiedProviderEvidence===false/);
 assert.match(ui,/reportPreview\.reports\.slice\(0,10\)/);
 assert.match(ui,/entry\.results\.slice\(0,3\)/);
 assert.match(ui,/not proof of a live provider call/);
 assert.match(ui,/canlı sağlayıcı çağrısının, doğruluğun veya görünürlük skorunun kanıtı değildir/);
 assert.equal(api.slice(api.indexOf('}else{')).includes('reportPreview={'),false);
});
