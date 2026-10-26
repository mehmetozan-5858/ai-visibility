import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Source-level concurrency guard: this route has Next.js and database imports,
// so verify the fail-closed control-flow contract without importing the handler,
// opening a database, or invoking Gemini.
const route=readFileSync(new URL('../app/api/clients/zera-ai-runner/route.js',import.meta.url),'utf8');

test('ZERA concurrent claim conflict stops the queue before later provider calls',()=>{
 const block=route.match(/if\s*\(\s*!claim\.rows\.length\s*\)\s*\{([^}]*)\}/);
 assert.ok(block,'expected explicit conflict handling for durable claim');
 assert.match(block[1],/\bbreak\s*;/,'conflict must end the task loop');
 assert.doesNotMatch(block[1],/\bcontinue\s*;/,'conflict must not advance to the next task');
});

test('ZERA obtains durable task claim before any provider comparison',()=>{
 const claim=route.indexOf('INSERT INTO zera_ai_task_attempts');
 const provider=route.indexOf('compareCustomerProviders({client');
 assert.ok(claim>=0 && provider>claim,'provider call must follow durable claim');
});
