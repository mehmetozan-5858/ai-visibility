import {Webhook} from 'svix';
export function verifyInboundWebhook(payload,headers,secret){
 if(!secret)throw new Error('webhook-not-configured');
 new Webhook(secret).verify(payload,{
  'svix-id':headers.get('svix-id')||'',
  'svix-timestamp':headers.get('svix-timestamp')||'',
  'svix-signature':headers.get('svix-signature')||''
 });
 return JSON.parse(payload);
}
export function mailbox(value){
 const s=String(value||'').trim(),angle=s.match(/<([^<>]+)>$/),address=(angle?.[1]||s).toLowerCase();
 return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(address)?address:'';
}
export function inboundText(email){
 const raw=String(email.text||email.html||'').slice(0,100000);
 return raw.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').trim().slice(0,6000);
}
export function trustedInbound(email,inbox){
 return Boolean(mailbox(inbox)&&email.authentication?.dmarc==='pass'&&(email.to||[]).some(x=>mailbox(x)===mailbox(inbox)));
}
