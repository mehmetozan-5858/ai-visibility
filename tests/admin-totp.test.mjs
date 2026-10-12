import test from "node:test";
import assert from "node:assert/strict";
import {decodeBase32,generateTotpSecret,totpAt,verifyTotp,totpUri} from "../lib/admin-totp.js";

test("RFC 6238 SHA1 test vector and bounded clock skew",()=>{
  const secret="GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  assert.equal(decodeBase32(secret).toString(),"12345678901234567890");
  assert.equal(totpAt(secret,59000),"287082");
  assert.equal(verifyTotp(secret,"287082",59000),true);
  assert.equal(verifyTotp(secret,"287082",89000),true);
  assert.equal(verifyTotp(secret,"287082",119000),false);
  assert.equal(verifyTotp(secret,"28708",59000),false);
  assert.equal(verifyTotp(secret,"000000",59000),false);
});
test("Generated authenticator secrets roundtrip and have standard URI",()=>{
  const secret=generateTotpSecret();
  assert.equal(decodeBase32(secret).length,20);
  assert.equal(verifyTotp(secret,totpAt(secret)),true);
  assert.match(totpUri(secret),/^otpauth:\/\/totp\//);
});
test("Malformed or short secrets cannot be used",()=>{
  assert.throws(()=>decodeBase32("bad!"));
  assert.throws(()=>decodeBase32("JBSWY3DP"));
  assert.equal(verifyTotp("bad!","123456"),false);
});
