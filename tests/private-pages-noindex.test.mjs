import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const files=[
  '../app/admin/layout.js',
  '../app/login/layout.js',
  '../app/sifremi-unuttum/layout.js',
  '../app/musteri-giris/layout.js',
  '../app/musteri-sifre-sifirla/layout.js',
  '../app/musteri-panel/layout.js',
  '../app/odeme/layout.js'
];

test('private and payment pages explicitly opt out of indexing',async()=>{
  for(const file of files){
    const source=await readFile(new URL(file,import.meta.url),'utf8');
    assert.match(source,/robots:\{index:false,follow:false/);
    assert.match(source,/noimageindex:true/);
  }
});
