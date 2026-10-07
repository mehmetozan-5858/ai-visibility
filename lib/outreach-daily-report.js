import {databasePool} from './database-runtime';
import {getDatabaseUrl} from './db';
import {validReportDate} from './reporting';
import {outreachReportRow} from './outreach-report-rules.js';
export async function dailyOutreachReport(date,deps={}){
 if(!validReportDate(date))throw Error('invalid-report-date');
 const pool=deps.pool||databasePool(getDatabaseUrl());
 const tables=(await pool.query("SELECT to_regclass('public.email_deliveries') AS deliveries,to_regclass('public.prospects') AS prospects")).rows[0];
 if(!tables?.deliveries)return {available:true,date,rows:[],accepted:0,uncertain:0,total:0,limited:false};
 const rows=(await pool.query(`SELECT d.*,${tables.prospects?'p.name,p.country,p.city,':'NULL AS name,NULL AS country,NULL AS city,'}
 COUNT(*) OVER() AS total,SUM(CASE WHEN d.provider_id<>'' AND d.status IN ('accepted','completed') THEN 1 ELSE 0 END) OVER() AS accepted
 FROM email_deliveries d ${tables.prospects?"LEFT JOIN prospects p ON p.id::text=split_part(d.delivery_key,'/',2)":''}
 WHERE (d.delivery_key LIKE 'prospect-first/%' OR d.delivery_key LIKE 'prospect-follow/%')
 AND COALESCE(d.completed_at,d.first_attempt_at)>=($1::date::timestamp AT TIME ZONE 'Europe/Istanbul')
 AND COALESCE(d.completed_at,d.first_attempt_at)<(($1::date+1)::timestamp AT TIME ZONE 'Europe/Istanbul')
 ORDER BY COALESCE(d.completed_at,d.first_attempt_at) DESC,d.delivery_key LIMIT 501`,[date])).rows;
 const total=Number(rows[0]?.total||0),accepted=Number(rows[0]?.accepted||0);
 return {available:true,date,total,accepted,uncertain:total-accepted,limited:rows.length>500,rows:rows.slice(0,500).map(outreachReportRow)};
}
