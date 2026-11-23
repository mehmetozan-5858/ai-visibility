// Sandbox-only evidence ledger. Deliberately never changes clients, payments or entitlement.
// The isolated Neon schema is paddle_sandbox_events/entities, not paddle_live_*.
import {databasePool} from './database-runtime.js';

const EVENT_TYPES = new Set(['transaction.completed','transaction.payment_failed',
  'subscription.created','subscription.activated','subscription.updated',
  'subscription.paused','subscription.resumed','subscription.canceled','subscription.past_due']);
const EVENT_ID=/^(?:evt|ntfsimevt)_[a-z0-9]+$/i;
const ENTITY_ID=/^(?:txn|sub)_[a-z0-9]+$/i;

export function normalizeSandboxEvidence(event) {
  const eventId=event?.event_id, type=event?.event_type, entityId=event?.data?.id;
  const occurredAt=event?.occurred_at;
  const customerId=event?.data?.customer_id;
  if (typeof eventId!=='string'||!EVENT_ID.test(eventId)||
      typeof type!=='string'||!EVENT_TYPES.has(type)||
      typeof entityId!=='string'||!ENTITY_ID.test(entityId)||
      (type.startsWith('transaction.')&&!entityId.startsWith('txn_'))||
      (type.startsWith('subscription.')&&!entityId.startsWith('sub_'))||
      typeof occurredAt!=='string'||!Number.isFinite(Date.parse(occurredAt))||
      (type==='transaction.completed'&&
        (typeof customerId!=='string'||!/^ctm_[a-z0-9]+$/i.test(customerId)||event?.data?.status!=='completed')))
    throw Error('invalid-sandbox-evidence');
  const priceIds=(Array.isArray(event?.data?.items)?event.data.items:[])
    .map(item=>item?.price?.id).filter(x=>typeof x==='string'&&/^pri_[a-z0-9]+$/i.test(x));
  return {eventId,type,entityId,customerId,occurredAt,status:String(event.data.status||'').slice(0,100),priceIds};
}

export async function recordSandboxEvidence(event,{databaseUrl, pool=databasePool(databaseUrl)}={}) {
  if (!databaseUrl) throw Error('sandbox-database-unavailable');
  const item=normalizeSandboxEvidence(event);
  const tx=await pool.connect();
  try {
    await tx.query('BEGIN');
    const added=(await tx.query(
      'INSERT INTO public.paddle_sandbox_events(event_id,event_type,entity_id,occurred_at) VALUES($1,$2,$3,$4) ON CONFLICT(event_id) DO NOTHING RETURNING event_id',
      [item.eventId,item.type,item.entityId,item.occurredAt])).rows;
    if (!added.length) {await tx.query('COMMIT');return {duplicate:true,entitlementGranted:false};}
    // A completed transaction is only reviewable when the exact isolated
    // checkout intent, customer mapping and catalog price all agree.
    // This does not establish settlement or grant paid access.
    if(item.type==='transaction.completed'){
      const match=await tx.query(`SELECT i.id FROM public.paddle_sandbox_checkout_intents i
        JOIN public.paddle_sandbox_customers c
          ON c.customer_id=i.paddle_customer_id AND c.client_id=i.client_id
        WHERE i.initial_transaction_id=$1 AND i.price_id=ANY($2::text[])
          AND i.created_at <= $3::timestamptz
          AND i.expires_at >= $3::timestamptz
          AND i.paddle_customer_id=$4 LIMIT 1`,
        [item.entityId,item.priceIds,item.occurredAt,item.customerId]);
      if(match.rows.length!==1) throw Error('sandbox-checkout-link-unverified');
    }
    await tx.query(`INSERT INTO public.paddle_sandbox_entities
      (entity_id,event_type,status,price_ids,occurred_at,event_id)
      VALUES($1,$2,$3,$4::jsonb,$5,$6)
      ON CONFLICT(entity_id) DO UPDATE SET event_type=EXCLUDED.event_type,
        status=EXCLUDED.status,price_ids=EXCLUDED.price_ids,
        occurred_at=EXCLUDED.occurred_at,event_id=EXCLUDED.event_id
      WHERE (paddle_sandbox_entities.occurred_at,paddle_sandbox_entities.event_id)
        < (EXCLUDED.occurred_at,EXCLUDED.event_id)`,
      [item.entityId,item.type,item.status,JSON.stringify(item.priceIds),item.occurredAt,item.eventId]);
    await tx.query('COMMIT');
    return {recorded:true,checkoutLinked:item.type==='transaction.completed',entitlementGranted:false};
  } catch (error) {
    await tx.query('ROLLBACK').catch(()=>{});
    throw error;
  } finally {tx.release();}
}
