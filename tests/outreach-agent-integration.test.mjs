import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const prospects=await readFile(new URL('../lib/prospects.js',import.meta.url),'utf8');
const email=await readFile(new URL('../lib/outreach-email.js',import.meta.url),'utf8');
test('lawful-basis flag defaults to false, is returned by communication query and gates first contact',()=>{
 assert.match(prospects,/ADD COLUMN IF NOT EXISTS lawful_basis_verified BOOLEAN NOT NULL DEFAULT FALSE/);
 const start=prospects.indexOf('export async function getCommunicationProspect(');
 assert.ok(start>=0);
 assert.match(prospects.slice(start,start+1450),/lawful_basis_verified AS "lawfulBasisVerified"/);
 assert.match(email,/lawfulBasisVerified:x\.lawfulBasisVerified===true/);
});
test('first-contact pricing experiment cannot reappear',()=>{
 const first=email.slice(email.indexOf('if(x.firstContact){'),email.indexOf('const name=esc(x.name)'));
 assert.doesNotMatch(first,/servicePrice|showPrices|formatMoney|priceExperimentVariant==='A'/);
 assert.match(first,/renderIntroOutreach/);
});

test('a new versioned migration runs for existing production databases',()=>{
 const fn=prospects.slice(prospects.indexOf('export async function getCommunicationProspect('));
 assert.match(fn,/initializeSchema\(p,'prospects-lawful-basis-v1'/);
 const migration=fn.indexOf("'prospects-lawful-basis-v1'");
 const select=fn.indexOf('FROM prospects WHERE id=\\$1');
 assert.ok(migration>=0 && select>migration);
});
