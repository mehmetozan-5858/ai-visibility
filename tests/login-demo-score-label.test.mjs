import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const src=await readFile(new URL('../components/CustomerLoginForm.js',import.meta.url),'utf8');
test('login preview score is explicitly labeled demo in Turkish and English',()=>{
 assert.match(src,/\["72\/100","Örnek skor · gerçek ölçüm değil"\]/);
 assert.match(src,/\["72\/100","Demo score · not a real measurement"\]/);
 assert.doesNotMatch(src,/\["72\/100","Görünürlük skoru"\]/);
 assert.doesNotMatch(src,/\["72\/100","Visibility score"\]/);
});
