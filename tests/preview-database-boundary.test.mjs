import test from "node:test";
import assert from "node:assert/strict";
import {getDatabaseUrl} from "../lib/db.js";

test("Preview never inherits Production database credentials", () => {
  const before = {
    VERCEL_ENV: process.env.VERCEL_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    STORAGE_URL: process.env.STORAGE_URL,
    ZERA_PREVIEW_DATABASE_URL: process.env.ZERA_PREVIEW_DATABASE_URL
  };
  try {
    process.env.DATABASE_URL = "postgres://prod-user:placeholder@prod.example/neondb";
    process.env.STORAGE_URL = "postgres://storage-user:placeholder@prod.example/neondb";
    process.env.VERCEL_ENV = "preview";
    delete process.env.ZERA_PREVIEW_DATABASE_URL;
    assert.equal(getDatabaseUrl(), "", "Preview must fail closed without dedicated database");
    process.env.ZERA_PREVIEW_DATABASE_URL = "postgres://preview-user:placeholder@preview.example/neondb";
    assert.equal(getDatabaseUrl(), process.env.ZERA_PREVIEW_DATABASE_URL);
    process.env.ZERA_PREVIEW_DATABASE_URL = "postgres://different-role:another-secret@prod.example/neondb?sslmode=require";
    assert.equal(getDatabaseUrl(), "", "Different credentials cannot bypass identical production database identity");
    process.env.ZERA_PREVIEW_DATABASE_URL = "postgres://preview-user:placeholder@prod.example/other_database";
    assert.equal(getDatabaseUrl(), process.env.ZERA_PREVIEW_DATABASE_URL, "Distinct database identity may be used");
    process.env.ZERA_PREVIEW_DATABASE_URL = "postgres://preview-user:placeholder@preview.example/neondb";

    process.env.VERCEL_ENV = "production";
    assert.equal(getDatabaseUrl(), process.env.DATABASE_URL);
  } finally {
    for (const [name,value] of Object.entries(before)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
