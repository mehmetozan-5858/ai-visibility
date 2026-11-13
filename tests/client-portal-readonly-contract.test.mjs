import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=async path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const between=(src,start,end)=>{
 const a=src.indexOf(start);
 assert.ok(a>=0,'missing '+start);
 const b=end?src.indexOf(end,a+start.length):src.length;
 assert.ok(b>a,'missing boundary '+end);
 return src.slice(a,b);
};

test('credential verification reads without request-time schema DDL',async()=>{
 const src=await source('lib/client-credentials.js');
 assert.match(src,/async function withDb\(fn,\{ensureSchema=true\}=\{\}\)/);
 assert.match(src,/if\(ensureSchema\)await pool\.query\(`CREATE TABLE/);
 for(const [start,end] of [
  ['export async function verifyClientCredential','export async function getClientCredential('],
  ['export async function getClientCredential(','export async function getClientCredentialByEmail('],
  ['export async function getClientCredentialByEmail(','// Server-only connection wrapper']
 ]){
  const body=between(src,start,end);
  assert.match(body,/ensureSchema:false/);
 }
});

test('pilot access lookup skips schema initialization without changing pilot grant writes',async()=>{
 const src=await source('lib/pilot-access.js');
 assert.match(src,/async function pool\(\{ensureSchema=true\}=\{\}\)/);
 assert.match(src,/if\(ensureSchema\)await initializeSchema/);
 assert.match(src,/getPilotAccess\(clientId\)\{const p=await pool\(\{ensureSchema:false\}\)/);
 assert.match(between(src,'export async function grantPilot','export async function revokePilot'),/const p=await pool\(\)/);
});

test('finding list queries are read-only and authorized writes remain separate',async()=>{
 const src=await source('lib/findings.js');
 assert.match(src,/if\(ensureSchema\)await ensure\(pool\)/);
 for(const [start,end] of [
  ['export async function listFindings(','export async function listFindingsForClient('],
  ['export async function listFindingsForClient(','export async function requestSolution(']
 ]){
  const body=between(src,start,end);
  assert.match(body,/ensureSchema:false/);
  assert.doesNotMatch(body,/\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bALTER\b|\bCREATE\b/i);
 }
 assert.match(between(src,'export async function requestSolution','export async function updateFindingOffer'),/UPDATE findings/);
});

test('solutions GET never synchronizes findings and checks signed customer access',async()=>{
 const src=await source('app/api/client-portal/solutions/route.js');
 const get=between(src,'export async function GET','export async function POST');
 assert.match(get,/verifyClientToken/);
 assert.match(get,/customerAccess\(account\)/);
 assert.match(get,/listFindingsForClient\(session\.clientId\)/);
 assert.doesNotMatch(get,/syncFindingsFromScan|getLatestCompletedScan|requestSolution/);
});

test('portal entitlement remains server-authorized rather than inferred from payment labels',async()=>{
 const src=await source('components/CustomerPortalGate.js');
 assert.match(src,/account\?\.access\?\.allowed===true/);
 assert.match(src,/account\.access\.kind==="pilot"\|\|unlocked/);
 assert.doesNotMatch(src,/account\?\.payments\|\|\[\]/);
});
