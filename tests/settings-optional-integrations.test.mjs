import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../components/SettingsManager.js',import.meta.url),'utf8');
test('WordPress is shown as optional rather than a launch blocker',()=>{
  assert.match(source,/key==="cms"/);
  assert.match(source,/Opsiyonel/);
  assert.match(source,/Vercel yayını için gerekli değil/);
});
