import {databasePool} from "./database-runtime.js";
import {getDatabaseUrl} from "./db.js";

/**
 * Launch flag defaults OFF. Enabling requires the reviewed SQL migration,
 * signed-provider E2E acceptance and a separately approved rollout.
 * No legacy bank-transfer or internal "paid" label is accepted as evidence.
 */
export const strictCustomerSettlementEnabled=()=>process.env.CUSTOMER_SETTLEMENT_PROOF_ENABLED==="true";

export function validSignedPaddleSettlement({payment,event}={}){
 return Boolean(payment?.id&&payment?.client_id&&payment?.status==="paid"&&
  payment?.method==="paddle"&&event?.id&&event?.type==="transaction.completed"&&
  event?.paymentId===payment.id&&event?.clientId===payment.client_id&&
  /^txn_[a-z0-9]+$/i.test(event?.entityId||""));
}

export async function customerHasVerifiedSettlement(clientId){
 if(typeof clientId!=="string"||!/^[0-9a-f-]{36}$/i.test(clientId))return false;
 const url=getDatabaseUrl();if(!url)return false;
 const pool=databasePool(url);
 try{
  const record=(await pool.query(`SELECT 1 FROM public.verified_customer_settlements s
   JOIN public.payments p ON p.id=s.payment_id AND p.client_id=s.client_id
   JOIN public.clients c ON c.id=s.client_id
   WHERE s.client_id=$1 AND p.status='paid' AND p.method='paddle'
     AND c.status<>'payment-review'
   LIMIT 1`,[clientId])).rows[0];
  return Boolean(record);
 }catch{return false} // Missing migration or read error must never grant access.
}
