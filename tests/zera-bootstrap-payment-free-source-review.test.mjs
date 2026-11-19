import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Enforce free pilot vs paid checkout boundaries at source level. This is
// synthetic CI evidence only, not an actual signed live invitation.
const paymentPage=await readFile(new URL('../app/odeme/page.js',import.meta.url),'utf8');
const paymentUi=await readFile(new URL('../components/PaymentManager.js',import.meta.url),'utf8');
const adminRoute=await readFile(new URL('../app/api/admin-pilots/route.js',import.meta.url),'utf8');
const setup=await readFile(new URL('../app/api/client-auth/setup/route.js',import.meta.url),'utf8');
const sendCode=await readFile(new URL('../app/api/client-auth/send-code/route.js',import.meta.url),'utf8');

test('pilot detection is from signed token service, never URL-supplied pilot flag',()=>{
 assert.match(paymentPage,/await verifyPaymentAccessToken\(token\)/);
 assert.match(paymentPage,/signed\?\.service==="pilot-diagnosis"/);
 assert.match(paymentPage,/!pilotOnly&&<PaddleLiveCheckout token=\{token\}\/>/);
 assert.match(paymentPage,/<PaymentManager token=\{token\} pilotOnly=\{pilotOnly\}/);
 assert.doesNotMatch(paymentPage,/searchParams.*pilotOnly/);
});
test('a missing or revoked pilot cannot fall back to paid UI',()=>{
 assert.match(paymentUi,/function PaymentManager\(\{token,pilotOnly=false\}\)/);
 assert.match(paymentUi,/if\(pilotOnly&&!d\.pilot\)return/);
 assert.match(paymentUi,/!d\.pilot&&<section className="grid reports-grid">/);
});
test('admin bootstrap is restricted to ZERA and existing server email-code authentication',()=>{
 assert.match(adminRoute,/b\.action==='bootstrap'/);
 assert.match(adminRoute,/c\?\.name!=='ZERA Clothing'/);
 assert.match(adminRoute,/b\.confirmZeraPilotBootstrap!==true/);
 assert.match(adminRoute,/if\(await getPilotAccess\(b\.clientId\)\)/);
 assert.match(sendCode,/sendVerificationEmail\(v\.email,v\.code\)/);
 assert.match(setup,/isEmailVerified\(access\.clientId,body\?\.email\)/);
 assert.match(setup,/createClientCredential\(access\.clientId,body\?\.email,body\?\.password\)/);
});
