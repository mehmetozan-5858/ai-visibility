import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('a late renewal receipt never directly reactivates a suspended client',async()=>{
 const src=await readFile(new URL('../lib/paddle-live.js',import.meta.url),'utf8');
 const start=src.indexOf('if(renewal.renewalRecorded){');
 const end=src.indexOf('if(isPaddleRenewal(item))return',start);
 assert.ok(start>=0&&end>start,'renewal success branch must be present');
 const renewal=src.slice(start,end);
 assert.match(renewal,/paymentChanged:true/);
 assert.doesNotMatch(renewal,/UPDATE\s+clients/i,'subscription state should be restored only via subscription lifecycle');
});
