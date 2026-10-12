import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../lib/strategy-learning-fast.js',import.meta.url),'utf8');
const match=source.match(/STRATEGY_LEARNING_REFRESH_SQL=`([\s\S]*?)`;\n/);
assert.ok(match,'strategy learning SQL constant must remain directly inspectable');
const SQL=match[1];

test('strategy learning canonicalizes dimensions before grouping and upsert',()=>{
 const sql=SQL.replace(/\s+/g,' ').toLowerCase();
 for(const expression of [
  "lower(btrim(coalesce(country,''))) country_key",
  "lower(btrim(coalesce(city,''))) city_key",
  "lower(btrim(coalesce(sector,''))) sector_key",
  "lower(btrim(coalesce(proposal_package,''))) package_key"
 ])assert.ok(sql.includes(expression),`missing canonical grouped dimension: ${expression}`);
 assert.match(sql,/from prospects group by 1,2,3,4/);
 assert.match(sql,/left join revenue r using\(country_key,city_key,sector_key,package_key\)/);
 assert.match(sql,/select country_key\|\|'\|'\|\|city_key\|\|'\|'\|\|sector_key\|\|'\|'\|\|package_key/);
 assert.doesNotMatch(sql,/select lower\(country\)\|\|/);
});

test('paid revenue uses the same canonical strategy dimensions as prospect metrics',()=>{
 const sql=SQL.replace(/\s+/g,' ').toLowerCase();
 const revenueStart=sql.indexOf('revenue as (');
 const metricsStart=sql.indexOf('metrics as (');
 assert.ok(revenueStart>=0&&metricsStart>revenueStart);
 const revenueSql=sql.slice(revenueStart,metricsStart);
 for(const field of ['p.country','p.city','p.sector','p.proposal_package']){
  assert.ok(revenueSql.includes(`lower(btrim(coalesce(${field},'')))`),`revenue dimension is not canonical: ${field}`);
 }
 assert.match(revenueSql,/group by 1,2,3,4/);
});
