import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=(await readFile(new URL('../lib/commercial-metrics.js',import.meta.url),'utf8')).replace(/export /g,'');
const {commercialMetrics}=new Function(source+';return {commercialMetrics};')();
const row={id:'p1',clientId:'c1',status:'paid',currency:'TRY',setupAmount:4990,monthlyAmount:100,paidAt:'2026-10-01T10:00:00Z',domain:'example.com',clientStatus:'active',termsVersion:'v1'};
test('test, local, unpaid, invalid currency and zero-value records never count as sales',()=>{
 const rows=[{...row,domain:'test.ai-visibility.local'},{...row,domain:'another.LOCAL'},{...row,termsVersion:'test-flow-2026-10-03'},{...row,status:'customer-reported'},{...row,currency:null},{...row,setupAmount:0,monthlyAmount:0}];
 const metrics=commercialMetrics(rows);assert.equal(metrics.activeClients,0);assert.equal(metrics.paid,0);assert.deepEqual(metrics.revenueByCurrency,[]);
});
test('currencies remain separate and renewal history never multiplies monthly amount',()=>{
 const metrics=commercialMetrics([row,{...row,id:'p2',setupAmount:0,paidAt:'2026-10-02T10:00:00Z'},{...row,id:'e1',clientId:'c2',currency:'EUR',setupAmount:119,monthlyAmount:29}]);
 assert.equal(metrics.activeClients,2);assert.equal(metrics.mrr,null);
 assert.deepEqual(metrics.mrrByCurrency,[{currency:'EUR',amount:29},{currency:'TRY',amount:100}]);
 assert.deepEqual(metrics.revenueByCurrency,[{currency:'EUR',amount:148},{currency:'TRY',amount:5190}]);
});
test('inactive service keeps historical collections but has no current monthly amount',()=>{
 const metrics=commercialMetrics([{...row,clientStatus:'suspended'}]);assert.equal(metrics.activeClients,0);assert.deepEqual(metrics.mrrByCurrency,[]);assert.equal(metrics.revenueByCurrency[0].amount,5090);
});
test('latest one-time package replaces prior recurring package without fractional rounding loss',()=>{
 const metrics=commercialMetrics([row,{...row,id:'p2',setupAmount:49.99,monthlyAmount:0,paidAt:'2026-10-03T10:00:00Z'}]);assert.equal(metrics.activeClients,1);assert.deepEqual(metrics.mrrByCurrency,[]);assert.equal(metrics.revenueByCurrency[0].amount,5139.99);
});
test('legacy missing payment date does not hide a newer package',()=>{
 const metrics=commercialMetrics([{...row,paidAt:null},{...row,id:'p2',monthlyAmount:200,paidAt:'2026-10-03T10:00:00Z'}]);assert.deepEqual(metrics.mrrByCurrency,[{currency:'TRY',amount:200}]);
});
