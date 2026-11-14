import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('free assessment consumes fragment token and clears browser URL before network request',async()=>{
 const source=await readFile(new URL('../components/FreeAssessment.js',import.meta.url),'utf8');
 const get=source.indexOf("new URLSearchParams(window.location.hash.slice(1)).get('token')");
 const clear=source.indexOf("window.history.replaceState(window.history.state,'',window.location.pathname+window.location.search)");
 const fetch=source.indexOf("fetch('/api/free-assessment'");
 assert.ok(get>=0&&clear>get&&fetch>clear,'fragment must be cleared after capture and before use');
 assert.match(source,/if\(!token\)/);
 assert.match(source,/'x-preview-token':token/);
 assert.doesNotMatch(source,/localStorage|sessionStorage|document\.cookie|location\.href\s*=/);
});
