import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const security=fs.readFileSync(new URL('../lib/api-security.js',import.meta.url),'utf8').replace(/^import .*;\s*$/mg,'').replaceAll('export ','');
const enforceSameOrigin=new Function('verifyAdminToken',security+';return enforceSameOrigin')(async()=>false);
const route=fs.readFileSync(new URL('../app/api/auth/login/route.js',import.meta.url),'utf8');
const logout=new Function('enforceSameOrigin',route.slice(route.indexOf('export async function DELETE')).replace('export ','')+';return DELETE')(enforceSameOrigin);
test('cross-origin admin logout fails without clearing the session cookie',async()=>{
 const req=new Request('https://app.example/api/auth/login',{method:'DELETE',headers:{origin:'https://attacker.example',host:'app.example'}});
 const res=await logout(req);assert.equal(res.status,403);assert.equal(res.headers.get('set-cookie'),null);
});
test('same-origin admin logout still expires its HttpOnly secure session',async()=>{
 const req=new Request('https://app.example/api/auth/login',{method:'DELETE',headers:{origin:'https://app.example',host:'app.example'}});
 const res=await logout(req);assert.equal(res.status,200);assert.match(res.headers.get('set-cookie'),/Max-Age=0/);assert.match(res.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);
});
