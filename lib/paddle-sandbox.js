import {createHmac,timingSafeEqual} from 'node:crypto';
import {PADDLE_SANDBOX_CATALOG} from './paddle-sandbox-catalog.js';
import {servicePrice} from './regional-pricing.js';

export function sandboxEnabled(env=process.env){
 return env.PADDLE_SANDBOX_ENABLED==='true' && ['preview','development'].includes(env.VERCEL_ENV) && env.PADDLE_ENVIRONMENT==='sandbox';
}
export function sandboxClientToken(env=process.env){
 const token=env.PADDLE_SANDBOX_CLIENT_TOKEN||'';
 return sandboxEnabled(env)&&/^test_[a-zA-Z0-9]+$/.test(token)?token:'';
}
export function sandboxCatalog(currency='USD'){
 const countries={TRY:'Türkiye',USD:'United States',EUR:'Germany',GBP:'United Kingdom'};
 if(!countries[currency])throw Error('unsupported-currency');
 return Object.entries(PADDLE_SANDBOX_CATALOG).map(([service,row])=>{
  const plan=servicePrice({service,country:countries[currency],language:'en'});
  return {...plan,productId:row.productId,priceId:row.prices[currency],environment:'sandbox'};
 });
}
export function verifyPaddleSignature(raw,header,secret,{now=Date.now(),tolerance=5}={}){
 if(!secret||typeof header!=='string'||typeof raw!=='string')return false;
 const parts=header.split(';').map(x=>x.trim().split('='));
 const times=parts.filter(([k])=>k==='ts');
 if(times.length!==1||!/^\d+$/.test(times[0][1]||''))return false;
 const ts=Number(times[0][1]);if(!Number.isSafeInteger(ts)||Math.abs(now/1000-ts)>tolerance)return false;
 const expected=createHmac('sha256',secret).update(times[0][1]+':'+raw).digest();
 return parts.filter(([k])=>k==='h1').some(([,v])=>/^[a-f0-9]{64}$/i.test(v||'')&&timingSafeEqual(expected,Buffer.from(v,'hex')));
}
export function sandboxEvent(event){
 if(!/^evt_[a-z0-9]+$/.test(event?.event_id||'')||!Number.isFinite(Date.parse(event.occurred_at)))throw Error('invalid-event');
 const type=String(event.event_type||'');
 if(!/^(transaction\.(completed|payment_failed)|subscription\.(created|activated|updated|paused|resumed|canceled|past_due))$/.test(type))return null;
 const data=event.data||{},subscription=type.startsWith('subscription.');
 if(!new RegExp(subscription?'^sub_[a-z0-9]+$':'^txn_[a-z0-9]+$').test(data.id||''))throw Error('invalid-entity');
 const known=new Set(Object.values(PADDLE_SANDBOX_CATALOG).flatMap(x=>Object.values(x.prices)));
 const prices=(data.items||[]).map(x=>x.price?.id||x.price_id);
 if(!prices.length||prices.some(x=>!known.has(x)))throw Error('unknown-price');
 return {id:event.event_id,type,entityId:data.id,occurredAt:event.occurred_at,status:String(data.status||''),priceIds:prices};
}
// Deliberately never imports the production repository or activates a customer.
export async function recordSandboxEvent(event,db){
 const item=sandboxEvent(event);if(!item)return {ignored:true};
 const tx=await db.connect();
 try{await tx.query('BEGIN');
  const inserted=await tx.query('INSERT INTO paddle_sandbox_events(event_id,event_type,entity_id,occurred_at) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING event_id',[item.id,item.type,item.entityId,item.occurredAt]);
  if(!inserted.rows.length){await tx.query('COMMIT');return {duplicate:true};}
  await tx.query(`INSERT INTO paddle_sandbox_entities(entity_id,event_type,status,price_ids,occurred_at,event_id) VALUES($1,$2,$3,$4::jsonb,$5,$6)
   ON CONFLICT(entity_id) DO UPDATE SET event_type=EXCLUDED.event_type,status=EXCLUDED.status,price_ids=EXCLUDED.price_ids,occurred_at=EXCLUDED.occurred_at,event_id=EXCLUDED.event_id
   WHERE (paddle_sandbox_entities.occurred_at,paddle_sandbox_entities.event_id)<(EXCLUDED.occurred_at,EXCLUDED.event_id)`,[item.entityId,item.type,item.status,JSON.stringify(item.priceIds),item.occurredAt,item.id]);
  await tx.query('COMMIT');return {recorded:true,productionAccessChanged:false};
 }catch(e){await tx.query('ROLLBACK');throw e}finally{tx.release()}
}
export function sandboxDatabaseUrl(env=process.env){
 if(!sandboxEnabled(env))return '';
 const value=env.PADDLE_SANDBOX_DATABASE_URL||'';if(!value)return '';
 // Require a distinct database identity, including differently encoded URLs.
 try{const test=new URL(value);const identity=u=>{const x=new URL(u);return x.hostname+':'+(x.port||'5432')+decodeURIComponent(x.pathname)};
  if(!['postgres:','postgresql:'].includes(test.protocol))return '';
  for(const key of ['DATABASE_URL','POSTGRES_URL','POSTGRES_URL_NON_POOLING','DATABASE_URL_UNPOOLED'])if(env[key]&&identity(value)===identity(env[key]))return '';
  return value;
 }catch{return ''}
}
