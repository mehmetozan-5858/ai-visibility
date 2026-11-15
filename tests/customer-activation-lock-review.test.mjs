import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('bank confirmation takes canonical tenant advisory lock before paying and activating', async () => {
 const code=await fs.readFile(new URL('../lib/repository.js',import.meta.url),'utf8');
 const start=code.indexOf('export async function confirmPayment(');
 const end=code.indexOf('export async function upsertSalesOpportunity(',start);
 assert.ok(start>=0&&end>start);
 const fn=code.slice(start,end);
 const lookup=fn.indexOf('SELECT client_id FROM payments WHERE id=$1');
 const lock=fn.indexOf("pg_advisory_xact_lock(pg_catalog.hashtextextended('portal-pilot-lock-v1:");
 const paid=fn.indexOf("UPDATE payments SET status='paid'");
 const active=fn.indexOf("UPDATE clients SET plan=$2,status='active'");
 assert.ok(lookup>0&&lock>lookup&&paid>lock&&active>paid);
 assert.match(fn,/payment-client-mismatch/);
 assert.match(fn,/await tx\.query\("ROLLBACK"\)/);
});

test('card confirmation is a separate blocked writer path until serialized', async () => {
 const code=await fs.readFile(new URL('../lib/repository.js',import.meta.url),'utf8');
 const start=code.indexOf('export async function confirmCardPaymentByMerchantOid(');
 const end=code.indexOf('export async function markCardPaymentFailedByMerchantOid(',start);
 assert.ok(start>=0&&end>start);
 const fn=code.slice(start,end);
 assert.match(fn,/UPDATE clients SET plan=\$2,status='active'/);
 // This test records the still-open gate. It MUST be changed to a lock-order
 // assertion when card confirmation is made atomic and coordinated.
});
