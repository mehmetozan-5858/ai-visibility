import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

test("read-only preflight checks exact security-critical foreign and unique keys",async()=>{
 const sql=await readFile(new URL("../docs/customer-journey-constraints-preflight.readonly.sql",import.meta.url),"utf8");
 assert.match(sql,/expected\(table_name,constraint_name,kind\)/);
 for(const name of [
  "applicant_assessment_links_prospect_id_key",
  "applicant_assessment_links_review_id_key",
  "applicant_assessment_deliveries_lead_id_key",
  "verified_customer_settlements_paddle_event_id_key",
  "verified_customer_settlements_transaction_id_key",
  "verified_customer_settlements_payment_id_fkey",
  "verified_customer_settlements_client_id_fkey"
 ])assert.ok(sql.includes(name),`expected exact key missing: ${name}`);
 assert.match(sql,/c\.conname=e\.constraint_name AND c\.contype=e\.kind/);
 assert.match(sql,/pg_catalog\.pg_get_constraintdef\(c\.oid\)/);
 assert.doesNotMatch(sql,/\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE|CREATE)\s+(?:TABLE|FROM|INTO|public\.)/i);
});
