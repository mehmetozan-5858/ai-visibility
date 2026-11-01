import test from "node:test";
import assert from "node:assert/strict";
import {createClientToken, verifyClientToken} from "../lib/admin-auth.js";
import {createAuditPreviewHandler} from "../lib/audit-preview-handler.mjs";

// Real application token functions, but a synthetic test secret and tenant.
// No network, provider, database, payment, or production credentials.
const origin = "http://127.0.0.1:23456";
const request = body => new Request(origin + "/api/client-audit-preview", {
  method: "POST",
  headers: {origin, host: new URL(origin).host, "content-type": "application/json"},
  body: JSON.stringify(body),
});

test("a real signed tenant-only client token cannot authorize a report actor or touch storage", async () => {
  const oldSecret = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = "synthetic-actor-boundary-test-secret-only";
  try {
    const token = await createClientToken("tenant_01", 3600);
    const session = await verifyClientToken(token);
    assert.equal(session?.clientId, "tenant_01");
    assert.equal(Object.hasOwn(session, "actorId"), false);
    assert.equal(Object.hasOwn(session, "verified"), false);

    const touched = [];
    const forbidden = label => () => {
      touched.push(label);
      throw new Error("unexpected " + label);
    };
    const handler = createAuditPreviewHandler({
      getSession: async () => verifyClientToken(token),
      getSettings: () => ({
        ARGE_REPORT_PREVIEW_ENABLED: "true",
        ARGE_AUDIT_SERVICE_ENABLED: "true",
      }),
      getClientAccount: forbidden("account"),
      customerAccess: forbidden("access"),
      getDatabaseUrl: forbidden("database-url"),
      databasePool: forbidden("database-pool"),
    });

    const response = await handler(request({requestId: "signed-tenant-only"}));
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), {error: "invalid-session-or-request"});
    assert.deepEqual(touched, [], "tenant-only token must fail before customer or database reads");
    assert.match(response.headers.get("cache-control"), /no-store/);

    // A client cannot upgrade its tenant token by adding actor assertions in JSON.
    const forged = await handler(request({
      requestId: "signed-tenant-only", actorId: "actor_01", verified: true,
    }));
    assert.equal(forged.status, 400);
    assert.deepEqual(await forged.json(), {error: "invalid-request"});
    assert.deepEqual(touched, []);
  } finally {
    if (oldSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = oldSecret;
  }
});
