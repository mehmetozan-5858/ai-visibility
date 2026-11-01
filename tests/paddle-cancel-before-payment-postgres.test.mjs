import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
const source=readFileSync(new URL('../lib/paddle-live.js',import.meta.url),'utf8')
 .replace(/^import .*;\s*$/gm,'').replace(/export /g,'');
test('delayed completed payment cannot undo earlier cancellation for same subscription',async()=>{
 const db=new PGlite();
 const client='550e8400-e29b-41d4-a716-446655440001',payment='550e8400-e29b-41d4-a716-446655440000';
 const sub='sub_cancelbeforepay1',txn='txn_cancelbeforepay1';
 try{
 await db.exec(`CREATE TABLE clients(id uuid PRIMARY KEY,status text,plan text);
 CREATE TABLE payments(id uuid PRIMARY KEY,client_id uuid,status text,currency text,plan text,setup_amount integer,monthly_amount integer,method text,paid_at timestamptz,service_start_consent_at timestamptz,terms_version text);`);
 await db.query("INSERT INTO clients VALUES($1,'pending','pilot')",[client]);
 await db.query("INSERT INTO payments(id,client_id,status,currency,plan,setup_amount,monthly_amount) VALUES($1,$2,'pending','EUR','pilot',0,49)",[payment,client]);
 const tx={query:(sql,args=[])=>db.query(sql,args),release(){}};
 const pool={query:tx.query,connect:async()=>tx};
 const record=new Function('databasePool','getDatabaseUrl','randomUUID',source+';return recordPaddleLiveEvent;')(()=>pool,()=> 'postgres://offline-only',randomUUID);
 const evt=(id,type,data,time)=>({event_id:id,event_type:type,occurred_at:time,data});
 await record(evt('evt_createdcancel1','subscription.created',{id:sub,status:'active',transaction_id:txn},'2026-11-01T08:00:00Z'));
 await record(evt('evt_canceledfirst1','subscription.canceled',{id:sub,status:'canceled'},'2026-11-01T08:01:00Z'));
 assert.equal((await db.query('SELECT status FROM clients WHERE id=$1',[client])).rows[0].status,'pending');
 await record(evt('evt_completedlater1','transaction.completed',{id:txn,status:'completed',origin:'api',currency_code:'EUR',subscription_id:sub,items:[{quantity:1,price:{unit_price:{amount:'4900'}}}],custom_data:{payment_id:payment,client_id:client}},'2026-11-01T08:02:00Z'));
 assert.equal((await db.query('SELECT status FROM payments WHERE id=$1',[payment])).rows[0].status,'paid');
 assert.equal((await db.query('SELECT status FROM clients WHERE id=$1',[client])).rows[0].status,'payment-review');
 }finally{await db.close()}
});
