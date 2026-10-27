import test from 'node:test';
import assert from 'node:assert/strict';
import {hasSameArgeOrigin} from '../lib/arge-request-origin.mjs';
const request=(origin,extra={})=>({url:'http://localhost:3000/api/client-audit-preview',
 headers:new Headers({host:'127.0.0.1:3000',...(origin?{origin}:{}),...extra})});
test('actual inbound Host is used instead of an internal Next hostname',()=>{
 assert.equal(hasSameArgeOrigin(request('http://127.0.0.1:3000')),true);
 assert.equal(hasSameArgeOrigin(request('http://localhost:3000')),false);
});
test('foreign, missing, path-bearing and invalid origins are rejected',()=>{
 for(const origin of [null,'null','https://other.invalid','http://127.0.0.1:3000/path','invalid'])
  assert.equal(hasSameArgeOrigin(request(origin)),false);
});
test('HTTPS proxy transport is explicit and scheme mismatches are rejected',()=>{
 assert.equal(hasSameArgeOrigin(request('https://127.0.0.1:3000',{'x-forwarded-proto':'https'})),true);
 assert.equal(hasSameArgeOrigin(request('http://127.0.0.1:3000',{'x-forwarded-proto':'https'})),false);
 assert.equal(hasSameArgeOrigin(request('http://127.0.0.1:3000',{'x-forwarded-proto':'https,http'})),false);
});
