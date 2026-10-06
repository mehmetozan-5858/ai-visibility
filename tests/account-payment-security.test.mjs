import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {readFile} from 'node:fs/promises';
const credentialSource=await readFile(new URL('../lib/client-credentials.js',import.meta.url),'utf8');
let stored;
const credentialPool={query:async(sql,args)=>{
 if(sql.includes('INSERT INTO client_credentials')){if(stored){if(sql.includes('DO UPDATE'))stored={clientId:args[0],email:args[1],passwordHash:args[2]};else return {rows:[]}}else stored={clientId:args[0],email:args[1],passwordHash:args[2]};return {rows:[stored]}}
 if(sql.includes('SELECT'))return {rows:stored?[stored]:[]};
 throw new Error('Unexpected query');
}};
globalThis.__credentialTest={withDb:fn=>fn(credentialPool),crypto};
const moduleSource='const {withDb,crypto}=globalThis.__credentialTest;\n'+credentialSource.slice(credentialSource.indexOf('function hashPassword'));
const credentials=await import('data:text/javascript;base64,'+Buffer.from(moduleSource).toString('base64'));
test('reusing setup cannot replace an existing credential',async()=>{
 await credentials.createClientCredential('client-id','owner@example.com','original-password');
 await assert.rejects(credentials.createClientCredential('client-id','attacker@example.com','replacement-password'),/credential-already-exists/);
 assert.ok(await credentials.verifyClientCredential('owner@example.com','original-password'));
 assert.equal(await credentials.verifyClientCredential('owner@example.com','replacement-password'),null);
 assert.equal(stored.email,'owner@example.com');
});
const repository=await readFile(new URL('../lib/repository.js',import.meta.url),'utf8');
const confirmSource=repository.slice(repository.indexOf('export async function confirmPayment('),repository.indexOf('export async function upsertSalesOpportunity'));
let failClient=false,paid=false,committed=false,rolledBack=false;
const tx={query:async(sql,args)=>{if(sql==='BEGIN'){committed=false;rolledBack=false;return {rows:[]}}if(sql.includes('UPDATE payments')){assert.ok(sql.includes("status='customer-reported'"));assert.ok(!sql.includes('setup_amount='));paid=true;return {rows:[{id:args[0],clientId:'client',plan:'Diagnosis',setupAmount:4990,monthlyAmount:0,currency:'TRY'}]}}if(sql.includes('UPDATE clients')){if(failClient)throw new Error('client-update-failed');return {rows:[]}}if(sql==='COMMIT')committed=true;if(sql==='ROLLBACK'){rolledBack=true;paid=false}return {rows:[]}},release(){}};
globalThis.__paymentTest={withDb:fn=>fn({connect:async()=>tx})};
const {confirmPayment}=await import('data:text/javascript;base64,'+Buffer.from('const {withDb}=globalThis.__paymentTest;\n'+confirmSource).toString('base64'));
test('one-time payment confirmation preserves invoice amounts and activates atomically',async()=>{
 const row=await confirmPayment('payment',{setupAmount:0,monthlyAmount:0});assert.equal(row.setupAmount,4990);assert.equal(row.monthlyAmount,0);assert.equal(committed,true);
 failClient=true;await assert.rejects(confirmPayment('payment'),/client-update-failed/);assert.equal(rolledBack,true);assert.equal(paid,false);
});
const intentSource=repository.slice(repository.indexOf('export async function getOrCreatePaymentIntent'),repository.indexOf('export async function recordPaymentConsent'));
globalThis.__intentTest={crypto,withDb:async fn=>fn({query:async(sql,args)=>{
 if(sql.includes('SELECT')){assert.equal(args.length,5);return {rows:[]}}
 if(sql.includes('INSERT')){const columns=sql.match(/payments\(([^)]+)\)/)[1].split(',');assert.equal(new Set(columns).size,columns.length);assert.equal(columns.length,args.length);assert.equal(args[8],'EUR');return {rows:[{id:args[0],plan:args[5],setupAmount:args[6],monthlyAmount:args[7],currency:args[8]}]}}
 throw new Error('Unexpected query');
}})};
const {getOrCreatePaymentIntent}=await import('data:text/javascript;base64,'+Buffer.from('const {crypto,withDb}=globalThis.__intentTest;\n'+intentSource).toString('base64'));
test('a new intent persists exact invoice columns and returns its currency',async()=>{
 const row=await getOrCreatePaymentIntent('client','Diagnosis',119,0,'EUR');assert.equal(row.currency,'EUR');assert.equal(row.setupAmount,119);
});
