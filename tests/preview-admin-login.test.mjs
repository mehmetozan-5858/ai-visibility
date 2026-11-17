import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

test("Preview login fails closed without isolated DB rather than rejecting password", async () => {
  const login = await fs.readFile(new URL("../app/api/auth/login/route.js", import.meta.url),"utf8");
  const gate = 'if(process.env.VERCEL_ENV==="preview" && !getDatabaseUrl())';
  assert.ok(login.includes(gate),"Missing Preview DB gate");
  assert.ok(login.indexOf(gate) < login.indexOf("verifyAdminPassword(body?.password"),"Preview must fail before password lookup");
  assert.ok(login.includes('status:503'),"Preview must identify environment configuration failure");
  assert.ok(login.includes("Mevcut şifreniz değişmedi"),"Error should not encourage password reset");
});

test("Preview login page hides password inputs without isolated DB",async()=>{
  const page=await fs.readFile(new URL("../app/login/page.js", import.meta.url),"utf8");
  assert.match(page, /process.env.VERCEL_ENV==="preview" && !getDatabaseUrl\(\)/);
  assert.match(page, /Önizleme: yönetici girişi kapalı/);
  assert.match(page, /https:\/\/www.aivisibilityworks.com\/login/);
  assert.ok(page.indexOf("if(process.env.VERCEL_ENV") < page.indexOf("return <main><LoginForm/>"));
});
