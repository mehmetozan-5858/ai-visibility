import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
const sub='sub_early123',txn='txn_first123',payment='550e8400-e29b-41d4-a716-446655440000',client='550e8400-e29b-41d4-a716-446655440001';
test('PostgreSQL early subscription then completed payment only activates verified tenant',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`CREATE TABLE payments(id uuid primary key,client_id uuid,status text);
 CREATE TABLE clients(id uuid primary key,status text);
 CREATE TABLE paddle_live_subscription_origins(subscription_id text primary key,transaction_id text not null);
 CREATE TABLE paddle_live_subscription_links(subscription_id text primary key,payment_id uuid not null,client_id uuid not null,transaction_id text not null);
 CREATE TABLE paddle_live_entities(entity_id text primary key,event_type text,status text,payment_id uuid,client_id uuid,occurred_at timestamptz,event_id text);`);
 await db.query("INSERT INTO clients VALUES($1,'pending')",[client]);
 await db.query("INSERT INTO payments VALUES($1,$2,'pending')",[payment,client]);
 await db.query('INSERT INTO paddle_live_subscription_origins VALUES($1,$2)',[sub,txn]);
 await db.query("INSERT INTO paddle_live_entities VALUES($1,'subscription.activated','active',NULL,NULL,'2026-11-01T08:00:00Z','evt_early')",[sub]);
 let eligible=await db.query(`SELECT c.id FROM clients c JOIN payments p ON p.client_id=c.id AND p.id=$2 AND p.status='paid'
 JOIN paddle_live_subscription_links l ON l.client_id=c.id AND l.payment_id=p.id AND l.subscription_id=$3
 JOIN paddle_live_subscription_origins o ON o.subscription_id=l.subscription_id AND o.transaction_id=$4
 WHERE c.id=$1`,[client,payment,sub,txn]);
 assert.equal(eligible.rows.length,0);
 await db.query("UPDATE payments SET status='paid' WHERE id=$1 AND client_id=$2",[payment,client]);
 await db.query('INSERT INTO paddle_live_subscription_links VALUES($1,$2,$3,$4)',[sub,payment,client,txn]);
 eligible=await db.query(`SELECT c.id FROM clients c JOIN payments p ON p.client_id=c.id AND p.id=$2 AND p.status='paid'
 JOIN paddle_live_subscription_links l ON l.client_id=c.id AND l.payment_id=p.id AND l.subscription_id=$3
 JOIN paddle_live_subscription_origins o ON o.subscription_id=l.subscription_id AND o.transaction_id=$4
 WHERE c.id=$1`,[client,payment,sub,txn]);
 assert.equal(eligible.rows.length,1);
 assert.equal((await db.query(`SELECT c.id FROM clients c JOIN payments p ON p.client_id=c.id AND p.id=$2 AND p.status='paid'
 JOIN paddle_live_subscription_links l ON l.client_id=c.id AND l.payment_id=p.id AND l.subscription_id=$3
 JOIN paddle_live_subscription_origins o ON o.subscription_id=l.subscription_id AND o.transaction_id=$4
 WHERE c.id=$1`,['550e8400-e29b-41d4-a716-446655440002',payment,sub,txn])).rows.length,0);
 }finally{await db.close()}
});