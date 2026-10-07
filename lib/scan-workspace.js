export async function readScanWorkspace(fetcher,signal){
 const read=async path=>{const r=await fetcher(path,{cache:'no-store',signal});if(!r.ok)throw Error([401,403].includes(r.status)?'scan-session-required':'scan-source-unavailable');try{return await r.json()}catch{throw Error('scan-source-unavailable')}};
 const [c,s,st]=await Promise.all(['/api/clients','/api/scans','/api/status'].map(read));
 if(s.mode!=='database'||st.database?.configured!==true)throw Error('scan-database-required');
 if(!Array.isArray(c.clients)||!c.clients.every(x=>x?.id&&typeof x.name==='string')||!Array.isArray(s.scans)||!Array.isArray(st.providers)||!['ChatGPT','Gemini','Perplexity'].every(name=>st.providers.filter(x=>x?.name===name&&['connected','not-connected'].includes(x.status)).length===1))throw Error('scan-source-unavailable');
 return {clients:c.clients,scans:s.scans,providers:st.providers};
}
export function provisionalScore(value){return value!==null&&value!==undefined&&String(value).trim()!==''&&Number.isFinite(Number(value))&&Number(value)>=0&&Number(value)<=100?Number(value)+'/100':'—'}
export function scanCompletionMessage(result,prefix=''){
 const ok=Array.isArray(result.providers)?result.providers:[],bad=Array.isArray(result.providerErrors)?result.providerErrors:[];
 return `${prefix}${ok.length}/3 sağlayıcı yanıtı kaydedildi · ${ok.map(x=>`${x.name} ön puan ${provisionalScore(x.score)}`).join(' · ')} · Tarama ön puanı ${provisionalScore(result.scan?.score)}${bad.length?` · ${bad.length} sağlayıcı hatası`:''}. Genel AI görünürlük ölçümü değildir.`;
}
