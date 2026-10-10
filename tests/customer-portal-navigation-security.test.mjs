import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("customer portal only unlocks on server-authorized paid access",()=>{
 const gate=read("components/CustomerPortalGate.js");
 assert.match(gate,/account\?\.access\?\.kind==="paid"/);
 assert.doesNotMatch(gate,/\.some\(p=>String\(p\.status/);
 assert.match(gate,/\/api\/client-portal/);
 assert.match(gate,/customer-locked-grid/);
});
test("customer sidebar opens live portal tabs rather than missing hash anchors",()=>{
 const shell=read("components/CustomerShell.js");
 const portal=read("components/CustomerPortal.js");
 const css=read("app/customer-portal-premium.css");
 assert.match(shell,/customer-portal-tab/);
 for(const tab of ["findings","scans","payments"]){
  assert.ok(shell.includes('openPortalTab("'+tab+'")'),tab);
  assert.ok(portal.includes('"'+tab+'"'),tab);
 }
 for(const hash of ["#portal-work","#portal-reports","#portal-account"])assert.ok(!shell.includes(hash),hash);
 assert.match(portal,/addEventListener\("customer-portal-tab"/);
 assert.match(portal,/removeEventListener\("customer-portal-tab"/);
 assert.match(css,/\.customer-side nav button:focus-visible/);
});
