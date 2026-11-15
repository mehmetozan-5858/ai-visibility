import {randomUUID} from "node:crypto";
import {databasePool} from "./database-runtime";
import {getDatabaseUrl} from "./db";
import {acquirePilotAdvisoryLockReview} from "./portal-pilot-advisory-lock-review.mjs";

export async function reversePayment(id,reason){
 const url=getDatabaseUrl();if(!url)throw Error("Veritabanı bağlantısı gerekli.");
 const tx=await databasePool(url).connect();
 try{
  await tx.query("BEGIN ISOLATION LEVEL READ COMMITTED");
  await tx.query("SET LOCAL lock_timeout = '2500ms'");
  await tx.query("SET LOCAL statement_timeout = '10000ms'");
  // Resolve the tenant from the stored payment BEFORE taking row locks.
  // Report RPC and other entitlement writers take this same advisory lock
  // first; locking the payment row before the tenant lock risks deadlock.
  const bound=(await tx.query(
   'SELECT client_id AS "clientId" FROM payments WHERE id=$1',[id])).rows[0];
  if(!bound)throw Error("Yalnızca onaylı havale kaydı geri alınabilir.");
  await acquirePilotAdvisoryLockReview(tx,bound.clientId);
  const payment=(await tx.query(
   "SELECT * FROM payments WHERE id=$1 AND client_id=$2 FOR UPDATE",
   [id,bound.clientId])).rows[0];
  if(!payment||payment.status!=="paid"||payment.method!=="bank-transfer")throw Error("Yalnızca onaylı havale kaydı geri alınabilir.");
  await tx.query("SELECT id FROM clients WHERE id=$1 FOR UPDATE",[payment.client_id]);
  await tx.query("UPDATE payments SET status='customer-reported',paid_at=NULL WHERE id=$1",[id]);
  const remaining=(await tx.query("SELECT 1 FROM payments WHERE client_id=$1 AND status='paid' LIMIT 1",[payment.client_id])).rows.length>0;
  if(!remaining){
   await tx.query("UPDATE clients SET status='payment-review' WHERE id=$1",[payment.client_id]);
   const tables=(await tx.query("SELECT to_regclass('public.prospects') AS business,to_regclass('public.creator_hunt_leads') AS creator")).rows[0]||{};
   if(tables.business)await tx.query("UPDATE prospects SET crm_stage='payment-pending',reply_status='review-required',payment_link_status='pending',follow_up_at=NULL WHERE client_id=$1",[payment.client_id]);
   if(tables.creator)await tx.query("UPDATE creator_hunt_leads SET crm_stage='payment-pending',payment_link_status='pending',next_follow_up=NULL,follow_up_due_at=NULL,updated_at=NOW() WHERE client_id=$1",[payment.client_id]);
  }
  await tx.query("INSERT INTO client_activity(id,client_id,event_type,title,detail,metadata) VALUES($1,$2,'payment','Yanlış ödeme onayı geri alındı',$3,$4::jsonb)",[randomUUID(),payment.client_id,reason,JSON.stringify({paymentId:id,referenceCode:payment.reference_code,previousStatus:payment.status,previousPaidAt:payment.paid_at,previousCurrency:payment.currency,accessSuspended:!remaining})]);
  await tx.query("COMMIT");return {id,status:"customer-reported",accessSuspended:!remaining};
 }catch(e){await tx.query("ROLLBACK").catch(()=>{});throw e}finally{tx.release()}
}
