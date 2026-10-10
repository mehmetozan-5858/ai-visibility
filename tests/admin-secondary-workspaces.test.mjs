import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("clients workspace keeps real managers and enterprise framing",()=>{
  const page=read("app/musteriler/page.js");
  assert.match(page,/ProspectsManager/);
  assert.match(page,/ClientsManager/);
  assert.match(page,/CLIENT OPERATIONS/);
  assert.match(page,/Aday → değerlendirme → müşteri/);
  assert.match(page,/admin-workspace-intro/);
});

test("scans workspace keeps real scan manager and evidence-first framing",()=>{
  const page=read("app/taramalar/page.js");
  assert.match(page,/ScanManager/);
  assert.match(page,/MEASUREMENT CONTROL/);
  assert.match(page,/Önce doğrula, sonra yorumla/);
  assert.match(page,/Tarama geçmişi/);
});

test("settings workspace keeps real settings and test center",()=>{
  const page=read("app/ayarlar/page.js");
  assert.match(page,/SettingsManager/);
  assert.match(page,/TestCenter/);
  assert.match(page,/SYSTEM CONTROL/);
  assert.match(page,/Değiştir → test et → doğrula/);
  assert.match(page,/Test merkezi/);
});
