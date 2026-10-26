import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../app/api/clients/zera-ai-runner/route.js',import.meta.url),'utf8');

test('ZERA legacy attempt reads detect whether optional failure_reason exists',()=>{
 assert.match(source,/const failureField=columns\.rows\.length/);
 assert.match(source,/information_schema\.columns/);
 assert.match(source,/failure_reason AS \"failureReason\"/);
});

test('ZERA previously attempted tasks block further provider calls',()=>{
 const prior=source.indexOf('if(prior.length)');
 const providerCall=source.indexOf('await compareCustomerProviders(');
 assert.ok(prior>=0&&providerCall>prior);
 assert.match(source,/if\(prior\.length\)return Response\.json/);
});

test('ZERA errors persist categorical reasons but not raw provider payloads',()=>{
 assert.match(source,/function safeFailureReason\(/);
 assert.match(source,/failure_reason=\$3/);
 assert.match(source,/reason:safeFailureReason|const reason=safeFailureReason/);
 assert.doesNotMatch(source,/JSON\.stringify\(response\)/);
});
