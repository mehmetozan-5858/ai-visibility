import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {collectZeraOwnedSite,ZERA_OWNED_SITE} from '../lib/zera-owned-site-collector.mjs';

test('first-party collector never calls an external search provider',async()=>{
 let seen;
 const result=await collectZeraOwnedSite({fetchImpl:async(url,opts)=>{
  seen={url,opts};
  return new Response('<html><title>ZERA Official</title></html>',{headers:{'content-type':'text/html'}});
 }});
 assert.equal(seen.url,ZERA_OWNED_SITE);
 assert.equal(seen.opts.redirect,'manual');
 assert.equal(result.status,'collected');
 assert.equal(result.title,'ZERA Official');
 assert.equal(result.verified,false);
 assert.equal(result.googleRank,null);
});
test('redirects, non-html, and oversized pages do not count',async()=>{
 const redirect=await collectZeraOwnedSite({fetchImpl:async()=>new Response(null,{status:302,headers:{location:'https://example.net'}})});
 assert.equal(redirect.verified,false);
 const huge=await collectZeraOwnedSite({fetchImpl:async()=>new Response('x'.repeat(70000),{headers:{'content-type':'text/html'}})});
 assert.equal(huge.status,'oversize');
});
test('endpoint is admin-only, same-origin and cannot mark Google tasks done',()=>{
 const source=readFileSync(new URL('../app/api/clients/zera-owned-site/route.js',import.meta.url),'utf8');
 assert.match(source,/requireAdmin\(req\)/);
 assert.match(source,/enforceSameOrigin\(req\)/);
 assert.match(source,/googleTasksCompleted:0/);
 assert.match(source,/saved:false/);
});

test('first-party collection stores only an unverified observation, never a Google score',()=>{
 const source=readFileSync(new URL('../app/api/clients/zera-owned-site/route.js',import.meta.url),'utf8');
 assert.match(source,/zera_owned_site_observations/);
 assert.match(source,/ON CONFLICT\(client_id,source_url\)/);
 assert.match(source,/verified:false,googleTasksCompleted:0,visibilityScore:null/);
 assert.match(source,/result\.status!=='collected'/);
});
