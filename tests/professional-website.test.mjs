import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("public page has bilingual copy and marked demo",()=>{const page=read("app/site-preview/page.tsx");assert.match(page,/const copy=\{tr:/);assert.match(page,/en:\{/);assert.match(page,/DEMO/);assert.match(page,/Temsili örnek/);});
test("portal preview is clearly labeled and has no outbound sales actions",()=>{const page=read("app/portal-preview/page.tsx");assert.match(page,/TEMSİLİ DEMO/);assert.match(page,/ILLUSTRATIVE DEMO/);assert.match(page,/Müşteri adayları/);assert.doesNotMatch(page,/fetch\(|sendEmail\(|paymentIntent\(/);});
test("responsive layout includes tablet and mobile breakpoints",()=>{const css=read("app/globals.css");const portal=read("app/portal-preview/page.tsx");assert.match(css,/@media/);assert.match(portal,/@media\(max-width:760px\)/);assert.match(portal,/overflow-x:auto/);});
