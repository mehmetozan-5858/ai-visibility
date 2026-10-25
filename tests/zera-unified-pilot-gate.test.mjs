import test from 'node:test';import assert from 'node:assert/strict';
import {zeraRegistrationGate} from '../pilot/zera-registration-gate.mjs';
test('registration and scan must share the same isolated preview prerequisites',()=>{
 const base={VERCEL_ENV:'preview',ZERA_ISOLATED_PREVIEW_DB:'verified',ZERA_PILOT_REGISTRATION_ENABLED:'true'};
 assert.equal(zeraRegistrationGate(base).allowed,true);
 assert.equal(zeraRegistrationGate({...base,VERCEL_ENV:'production'}).allowed,false);
 assert.equal(zeraRegistrationGate({...base,ZERA_ISOLATED_PREVIEW_DB:undefined}).allowed,false);
 assert.equal(zeraRegistrationGate({...base,ZERA_PILOT_REGISTRATION_ENABLED:'false'}).allowed,false);
});
