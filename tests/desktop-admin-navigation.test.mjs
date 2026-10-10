import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("desktop admin menu uses existing real routes",()=>{const code=read("components/MobileDashboard.js");for(const route of ["/admin","/lead-finder","/musteriler","/ajanlar","/taramalar","/raporlar","/ayarlar"])assert.ok(code.includes(route),route);assert.match(code,/mv-desktop-sidebar/);assert.match(code,/readDashboardSnapshot/);assert.match(code,/<BottomNavigation\/>/);});
test("desktop sidebar is hidden on mobile and only enabled at wide breakpoints",()=>{const css=read("app/mobile-dashboard.css");assert.match(css,/\.mv-desktop-sidebar\{display:none\}/);assert.match(css,/@media\(min-width:1200px\)/);assert.match(css,/\.mv \.mv-nav\{display:none\}/);});
