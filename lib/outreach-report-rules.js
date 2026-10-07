// Render persisted message text, never executable email markup.
export function emailText(payload={}){
 if(typeof payload.text==='string'&&payload.text)return payload.text;
 const entities={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
 return String(payload.html||'').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/(p|div|h[1-6]|tr|li)>/gi,'\n\n').replace(/<[^>]*>/g,'').replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(original,key)=>{
  if(key[0]!=='#')return entities[key.toLowerCase()]??original;
  const n=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):Number(key.slice(1));return n>0&&n<=0x10ffff?String.fromCodePoint(n):original;
 }).trim();
}
export function outreachReportRow(row){
 const payload=row.payload||{},accepted=Boolean(row.provider_id)&&['accepted','completed'].includes(row.status);
 return {id:row.delivery_key,name:row.name||'Firma kaydı bulunamadı',country:row.country||'',city:row.city||'',recipient:Array.isArray(payload.to)?payload.to.join(', '):String(payload.to||''),sender:String(payload.from||''),subject:String(payload.subject||''),body:emailText(payload),accepted,status:accepted?'Sağlayıcı kabul etti':'Gönderim sonucu belirsiz',kind:row.delivery_key.startsWith('prospect-follow/')?'Takip':'İlk temas',recordedAt:row.completed_at||row.first_attempt_at,firstAttemptAt:row.first_attempt_at};
}
