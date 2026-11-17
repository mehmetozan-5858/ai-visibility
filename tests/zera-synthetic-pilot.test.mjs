import test from "node:test";
import assert from "node:assert/strict";
import {PGlite} from "@electric-sql/pglite";

// In-memory synthetic database. No Neon/Vercel secrets, real clients or payments.
test("isolated synthetic pilot contract: zero-charge, expiry and revocation", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE clients (id uuid PRIMARY KEY, name text NOT NULL);
      CREATE TABLE client_pilot_access (
        client_id uuid PRIMARY KEY REFERENCES clients(id),
        email text NOT NULL,
        reason text NOT NULL,
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT NOW()
      );
      CREATE TABLE payments (
        id uuid PRIMARY KEY,
        client_id uuid REFERENCES clients(id),
        status text NOT NULL,
        amount integer NOT NULL
      );
    `);
    const fakeId = "11111111-1111-4111-8111-111111111111";
    await db.query("INSERT INTO clients(id,name) VALUES($1,$2)", [fakeId,"SYNTHETIC-ONLY TEST"]);
    const initial = await db.query("SELECT COUNT(*)::int AS n FROM payments");
    assert.equal(initial.rows[0].n, 0);
    await db.query(`
      INSERT INTO client_pilot_access(client_id,email,reason,expires_at)
      VALUES($1,$2,$3,NOW() + interval '7 days')
    `, [fakeId,"synthetic@example.invalid","Synthetic-only free pilot acceptance"]);
    const active = await db.query(`
      SELECT COUNT(*)::int AS n FROM client_pilot_access
      WHERE client_id=$1 AND revoked_at IS NULL AND expires_at > NOW()
    `, [fakeId]);
    assert.equal(active.rows[0].n, 1);
    await db.query("UPDATE client_pilot_access SET expires_at=NOW() - interval '1 second' WHERE client_id=$1", [fakeId]);
    const expired = await db.query(`
      SELECT COUNT(*)::int AS n FROM client_pilot_access
      WHERE client_id=$1 AND revoked_at IS NULL AND expires_at > NOW()
    `, [fakeId]);
    assert.equal(expired.rows[0].n, 0, "Expired pilot access must be rejected");
    await db.query("UPDATE client_pilot_access SET expires_at=NOW() + interval '7 days' WHERE client_id=$1", [fakeId]);
    await db.query("UPDATE client_pilot_access SET revoked_at=NOW() WHERE client_id=$1", [fakeId]);
    const revoked = await db.query(`
      SELECT COUNT(*)::int AS n FROM client_pilot_access
      WHERE client_id=$1 AND revoked_at IS NULL AND expires_at > NOW()
    `, [fakeId]);
    assert.equal(revoked.rows[0].n, 0);
    const final = await db.query("SELECT COUNT(*)::int AS n FROM payments");
    assert.equal(final.rows[0].n, 0, "Synthetic pilot must not create any payment record");
  } finally {
    await db.close();
  }
});
