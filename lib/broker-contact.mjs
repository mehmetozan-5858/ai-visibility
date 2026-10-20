import crypto from 'node:crypto';
export function normalizeContact(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||String(raw.website||'').trim())throw Error('invalid-contact');
 if(!['id','name','email','topic','message'].every(key=>typeof raw[key]==='string'))throw Error('invalid-contact');
 const row={id:String(raw.id||''),name:String(raw.name||'').trim(),email:String(raw.email||'').trim(),topic:String(raw.topic||'').trim(),message:String(raw.message||'').trim()};
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(row.id)||row.name.length<2||row.name.length>100||row.topic.length<3||row.topic.length>120||row.message.length<10||row.message.length>5000||row.email.length>254||!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(row.email)||/[\x00-\x1f\x7f]/.test(row.name+row.topic+row.email)||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(row.message))throw Error('invalid-contact');
 return row;
}
export function verifyContactSignature(raw,headers,secret,now=Date.now()){
 const timestamp=headers.get('x-broker-timestamp')||'',signature=headers.get('x-broker-signature')||'';
 if(!secret||!/^\d{10}$/.test(timestamp)||Math.abs(now/1000-Number(timestamp))>300||!/^[a-f0-9]{64}$/.test(signature))return false;
 const expected=crypto.createHmac('sha256',secret).update(timestamp+'\n'+raw).digest();
 return crypto.timingSafeEqual(expected,Buffer.from(signature,'hex'));
}
export function contactEmail(row,{to,from}){
 if(!to||!from||/@resend\.dev\b/i.test(from))throw Error('contact-email-not-configured');
 return {from,to:[to],reply_to:row.email,subject:'Global Broker — '+row.topic,text:'GLOBAL BROKER · Bize ulaşın\n\nAd: '+row.name+'\nYanıt adresi: '+row.email+'\nKonu: '+row.topic+'\nMesaj kimliği: '+row.id+'\n\n'+row.message};
}
export function createContactService({pool,initializeSchema,deliver,env=process.env}){
 async function ready(){await initializeSchema(pool,'broker-contact-v1',tx=>tx.query(`CREATE TABLE IF NOT EXISTS broker_contact_messages(id UUID PRIMARY KEY,body JSONB NOT NULL,body_hash TEXT NOT NULL,ip_hash TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'queued',provider_id TEXT NOT NULL DEFAULT '',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),forwarded_at TIMESTAMPTZ); CREATE INDEX IF NOT EXISTS broker_contact_created_idx ON broker_contact_messages(created_at); CREATE INDEX IF NOT EXISTS broker_contact_ip_created_idx ON broker_contact_messages(ip_hash,created_at)`))}
 async function forward(id){
  await ready();const row=(await pool.query('SELECT * FROM broker_contact_messages WHERE id=$1',[id])).rows[0];if(!row)throw Error('contact-not-found');
  if(row.status==='email_accepted')return {id,state:'email_accepted'};
  try{
   const payload=contactEmail(row.body,{to:env.ADMIN_RECOVERY_EMAIL,from:env.RESEND_FROM_EMAIL||env.EMAIL_FROM});
   await deliver('broker-contact:'+id,payload,async providerId=>{await pool.query("UPDATE broker_contact_messages SET status='email_accepted',provider_id=$2,forwarded_at=NOW() WHERE id=$1",[id,providerId])},{pool});
   return {id,state:'email_accepted'};
  }catch(error){
   if(error.message==='delivery-needs-review')await pool.query("UPDATE broker_contact_messages SET status='needs_review' WHERE id=$1 AND status<>'email_accepted'",[id]);
   return {id,state:'queued'};
  }
 }
 async function receive(raw){
  const body=normalizeContact(raw),ipHash=String(raw.ipHash||'');if(!/^[a-f0-9]{64}$/.test(ipHash))throw Error('invalid-contact');
  const hash=crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');await ready();const tx=await pool.connect();
  try{
   await tx.query('BEGIN');await tx.query("SELECT pg_advisory_xact_lock(hashtextextended('broker-contact-intake',0))");
   const existing=(await tx.query('SELECT body_hash FROM broker_contact_messages WHERE id=$1',[body.id])).rows[0];
   if(existing){if(existing.body_hash!==hash)throw Error('contact-conflict')}
   else{
    const counts=(await tx.query("SELECT count(*) FILTER(WHERE ip_hash=$1 AND created_at>NOW()-INTERVAL '10 minutes') AS recent,count(*) AS daily FROM broker_contact_messages WHERE created_at>NOW()-INTERVAL '24 hours'",[ipHash])).rows[0];
    if(Number(counts.recent)>=3||Number(counts.daily)>=50)throw Error('contact-rate-limit');
    await tx.query('INSERT INTO broker_contact_messages(id,body,body_hash,ip_hash) VALUES($1,$2,$3,$4)',[body.id,JSON.stringify(body),hash,ipHash]);
   }
   await tx.query('COMMIT');
  }catch(error){await tx.query('ROLLBACK').catch(()=>{});throw error}finally{tx.release()}
  return forward(body.id);
 }
 async function retry(){await ready();const rows=(await pool.query("SELECT id FROM broker_contact_messages WHERE status='queued' ORDER BY created_at LIMIT 2")).rows;for(const row of rows)await forward(row.id);return {processed:rows.length}}
 async function list(){await ready();return (await pool.query('SELECT id,body,status,created_at,forwarded_at FROM broker_contact_messages ORDER BY created_at DESC LIMIT 100')).rows}
 return {receive,forward,retry,list};
}
