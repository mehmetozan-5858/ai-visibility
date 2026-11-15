import test from 'node:test';
import assert from 'node:assert/strict';
import {createRetiredLegacyPost} from '../lib/zera-legacy-retirement.mjs';
const request = () => new Request('https://example.com/api/clients/zera-single-scan', {method:'POST'});
test('unauthorized caller denied before origin and never reaches retired body', async () => {
  let origins=0;
  const handler=createRetiredLegacyPost({authorize:async()=>Response.json({error:'unauthorized'},{status:401}),checkOrigin:()=>{origins++;return null}});
  const res=await handler(request());
  assert.equal(res.status,401); assert.equal(origins,0);
});
test('invalid origin denied before retirement response',async()=>{
  const handler=createRetiredLegacyPost({authorize:async()=>null,checkOrigin:()=>Response.json({error:'invalid origin'},{status:403})});
  assert.equal((await handler(request())).status,403);
});
test('authorized legacy POST always retired without reading request body or provider or DB',async()=>{
  const handler=createRetiredLegacyPost({authorize:async()=>null,checkOrigin:()=>null});
  const req=request();
  const res=await handler(req);
  assert.equal(res.status,410);
  assert.equal(res.headers.get('cache-control'),'private, no-store');
  assert.deepEqual(await res.json(),{error:'Legacy ZERA scan endpoint retired; use the guarded pilot workflow',code:'legacy-zera-scan-retired',providerRequests:0});
  assert.equal(req.bodyUsed,false);
});
