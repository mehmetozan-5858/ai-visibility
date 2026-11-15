import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('portal historical AI comparisons are never labeled live provider proof',async()=>{
 const route=await read('app/api/client-portal/route.js');
 const ui=await read('components/CustomerPortal.js');
 assert.match(route,/evidenceClass:'historical',verifiedProviderEvidence:false/);
 assert.match(ui,/geçmiş sorgu kaydı PDF raporunuzda mevcut/);
 assert.match(ui,/tarihsel kayıtlar canlı sağlayıcı yanıtı, doğrulanmış AI kanıtı/);
 assert.match(ui,/historical query records are available in your PDF/);
 assert.match(ui,/not verified live provider evidence/);
});
