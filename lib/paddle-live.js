import {createHmac,timingSafeEqual} from 'node:crypto';
import {databasePool} from './database-runtime.js';
import {getDatabaseUrl} from './db.js';

const ALLOWED_EVENTS=new Set([
  'transaction.completed','transaction.payment_failed',
  'subscription.created','subscription.activated','subscription.updated',
  'subscription.paused','subscription.resumed','subscription.canceled','subscription.past_due'
]);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function verifyPaddleLiveSignature(raw,header,secret,{now=Date.now(),tolerance=300}={}){
  if(!secret||typeof raw!=='string'||typeof header!=='string')return false;
  const parts=header.split(';').map(part=>part.trim().split('='));
  const timestamps=parts.filter(([key])=>key==='ts');
  if(timestamps.length!==1||!/^\d+$/.test(timestamps[0][1]||''))return false;
  const ts=Number(timestamps[0][1]);
  if(!Number.isSafeInteger(ts)||Math.abs(now/1000-ts)>tolerance)return false;
  const expected=createHmac('sha256',secret).update(`${timestamps[0][1]}:${raw}`).digest();
  return parts.filter(([key])=>key==='h1').some(([,value])=>{
    if(!/^[a-f0-9]{64}$/i.test(value||''))return false;
    return timingSafeEqual(expected,Buffer.from(value,'hex'));
  });
}

export function normalizePaddleLiveEvent(event){
  const id=String(event?.event_id||'');
  const type=String(event?.event_type||'');
  const occurredAt=String(event?.occurred_at||'');
  if(!/^(?:evt|ntfsimevt)_[a-z0-9]+$/i.test(id)||!Number.isFinite(Date.parse(occurredAt)))throw Error('invalid-event');
  if(!ALLOWED_EVENTS.has(type))return null;
  const data=event?.data&&typeof event.data==='object'?event.data:{};
  const entityId=String(data.id||'');
  const expectedPrefix=type.startsWith('subscription.')?'sub_':'txn_';
  if(!entityId.startsWith(expectedPrefix))throw Error('invalid-entity');
  const custom=data.custom_data&&typeof data.custom_data==='object'?data.custom_data:{};
  const paymentId=String(custom.payment_id||custom.paymentId||'');
  const clientId=String(custom.client_id||custom.clientId||'');
  return {id,type,occurredAt,entityId,status:String(data.status||''),paymentId,clientId,data};
}

async function ensure(pool){
  await pool.query(`CREATE TABLE IF NOT EXISTS paddle_live_events(
    event_id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    payment_id UUID,
    client_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS paddle_live_entities(
    entity_id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT '',
    payment_id UUID,
    client_id UUID,
    occurred_at TIMESTAMPTZ NOT NULL,
    event_id TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
}

function transactionTotal(data){
  const raw=data?.details?.totals?.grand_total??data?.details?.totals?.total??null;
  return /^\d+$/.test(String(raw??''))?Number(raw):null;
}
function transactionCurrency(data){return String(data?.currency_code||data?.currency||'').toUpperCase()}

async function applyTransaction(tx,item){
  if(!UUID.test(item.paymentId)||!UUID.test(item.clientId))return {linked:false,reason:'missing-payment-link'};
  const payment=(await tx.query(`SELECT id,client_id,status,currency,setup_amount,monthly_amount
    FROM payments WHERE id=$1 AND client_id=$2 FOR UPDATE`,[item.paymentId,item.clientId])).rows[0];
  if(!payment)return {linked:false,reason:'payment-not-found'};
  const currency=transactionCurrency(item.data);
  const total=transactionTotal(item.data);
  const expected=(Number(payment.setup_amount)||0)+(Number(payment.monthly_amount)||0);
  if(currency&&payment.currency&&currency!==payment.currency)return {linked:false,reason:'currency-mismatch'};
  if(total!==null&&total!==expected*100)return {linked:false,reason:'amount-mismatch'};
  if(item.type==='transaction.completed'){
    const updated=(await tx.query(`UPDATE payments SET status='paid',method='paddle',paid_at=COALESCE(paid_at,NOW())
      WHERE id=$1 AND client_id=$2 AND status<>'paid'
      RETURNING id,client_id,plan,status`,[item.paymentId,item.clientId])).rows[0];
    if(updated)await tx.query("UPDATE clients SET plan=$2,status='active' WHERE id=$1",[updated.client_id,updated.plan]);
    return {linked:true,paymentChanged:Boolean(updated),paymentStatus:'paid'};
  }
  if(item.type==='transaction.payment_failed'){
    const updated=(await tx.query(`UPDATE payments SET status='failed',method='paddle'
      WHERE id=$1 AND client_id=$2 AND status NOT IN ('paid','refunded') RETURNING id`,[item.paymentId,item.clientId])).rows[0];
    return {linked:true,paymentChanged:Boolean(updated),paymentStatus:updated?'failed':payment.status};
  }
  return {linked:true,paymentChanged:false,paymentStatus:payment.status};
}

export async function recordPaddleLiveEvent(event){
  const item=normalizePaddleLiveEvent(event);
  if(!item)return {ignored:true};
  const url=getDatabaseUrl();
  if(!url)throw Error('database-unavailable');
  const pool=databasePool(url);await ensure(pool);
  const tx=await pool.connect();
  try{
    await tx.query('BEGIN');
    const inserted=(await tx.query(`INSERT INTO paddle_live_events(event_id,event_type,entity_id,occurred_at,payment_id,client_id)
      VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING event_id`,[
      item.id,item.type,item.entityId,item.occurredAt,UUID.test(item.paymentId)?item.paymentId:null,UUID.test(item.clientId)?item.clientId:null
    ])).rows[0];
    if(!inserted){await tx.query('COMMIT');return {duplicate:true};}
    const paymentResult=item.type.startsWith('transaction.')?await applyTransaction(tx,item):{linked:UUID.test(item.paymentId)&&UUID.test(item.clientId),paymentChanged:false};
    await tx.query(`INSERT INTO paddle_live_entities(entity_id,event_type,status,payment_id,client_id,occurred_at,event_id)
      VALUES($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT(entity_id) DO UPDATE SET event_type=EXCLUDED.event_type,status=EXCLUDED.status,payment_id=COALESCE(EXCLUDED.payment_id,paddle_live_entities.payment_id),client_id=COALESCE(EXCLUDED.client_id,paddle_live_entities.client_id),occurred_at=EXCLUDED.occurred_at,event_id=EXCLUDED.event_id,updated_at=NOW()
      WHERE (paddle_live_entities.occurred_at,paddle_live_entities.event_id)<(EXCLUDED.occurred_at,EXCLUDED.event_id)`,[
      item.entityId,item.type,item.status,UUID.test(item.paymentId)?item.paymentId:null,UUID.test(item.clientId)?item.clientId:null,item.occurredAt,item.id
    ]);
    await tx.query('COMMIT');
    return {recorded:true,eventType:item.type,...paymentResult};
  }catch(error){await tx.query('ROLLBACK').catch(()=>{});throw error}finally{tx.release()}
}
