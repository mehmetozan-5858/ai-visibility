import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const read = async path => fs.readFile(new URL(path, import.meta.url), "utf8");

test("admin dashboard links to dedicated pilot access page", async () => {
  const dashboard = await read("../components/MobileDashboard.js");
  const page = await read("../app/admin/pilotlar/page.js");
  assert.match(dashboard, /href="\/admin\/pilotlar"/);
  assert.match(page, /PilotAccessManager/);
  assert.match(page, /await verifyAdminToken\(cookieStore.get\("ai_admin"\)/);
  assert.match(page, /if \(!authorized\) redirect\("\/login"\)/);
  assert.match(page, /robots:\s*\{\s*index:\s*false/);
});

test("pilot management API remains admin-only and requires same-origin for changes", async () => {
  const route = await read("../app/api/admin-pilots/route.js");
  assert.match(route, /GET\(req\)\{const denied=await requireAdmin\(req\)/);
  assert.match(route, /POST\(req\)\{const denied=await requireAdmin\(req\)/);
  assert.match(route, /const origin=enforceSameOrigin\(req\)/);
  assert.match(route, /getClientCredential\(b.clientId\)/);
  assert.match(route, /credential.email.toLowerCase\(\)!==/);
  assert.match(route, /grantPilot\(/);
  assert.doesNotMatch(route, /INSERT INTO payments|UPDATE payments/);
});
