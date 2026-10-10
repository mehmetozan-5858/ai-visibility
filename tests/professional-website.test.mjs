import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("public page has bilingual copy and marked demo",()=>{const page=read("app/site-preview/page.jsx");assert.match(page,/const copy=\{tr:/);assert.match(page,/en:\{/);assert.match(page,/DEMO/);assert.match(page,/Temsili örnek/);});
test("portal preview is clearly labeled and has no outbound sales actions",()=>{const page=read("app/portal-preview/page.jsx");assert.match(page,/TEMSİLİ DEMO/);assert.match(page,/ILLUSTRATIVE DEMO/);assert.match(page,/Müşteri adayları/);assert.doesNotMatch(page,/fetch\(|sendEmail\(|paymentIntent\(/);});
test("responsive layout includes tablet and mobile breakpoints",()=>{const css=read("app/globals.css");const portal=read("app/portal-preview/page.jsx");assert.match(css,/@media/);const scoped=read("app/site-preview/preview.css");assert.match(scoped,/\.site-preview \.hero/);assert.match(scoped,/@media\(max-width:800px\)/);assert.match(read("app/site-preview/page.jsx"),/import "\.\/preview.css"/);assert.match(portal,/@media\(max-width:760px\)/);assert.match(portal,/overflow-x:auto/);});

test("design previews are excluded from search indexing",()=>{for(const route of ["site-preview","portal-preview"]){const layout=read("app/"+route+"/layout.jsx");assert.match(layout,/index:\s*false/);assert.match(layout,/follow:\s*false/);}});
