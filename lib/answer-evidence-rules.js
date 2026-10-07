export function sourceUrl(raw){try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port?u.href:''}catch{return ''}}
const normalized=value=>String(value||'').normalize('NFKC').toLocaleLowerCase('tr-TR').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function brandMatch(text,entity){
 const hay=' '+normalized(text)+' ',name=normalized(entity.name);
 if(name.length>=4&&hay.includes(' '+name+' '))return true;
 let domain='';try{domain=new URL(/^https?:\/\//i.test(entity.domain)?entity.domain:'https://'+entity.domain).hostname.replace(/^www\./,'').toLowerCase()}catch{}
 const literal=String(text||'').toLowerCase();
 const escaped=domain.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 return !!domain&&new RegExp('(?<![a-z0-9.-])(?:www\\.)?'+escaped+'(?![a-z0-9-]|\\.[a-z0-9])','i').test(literal);
}
export function evidenceQueries(entity,input=[],language='tr'){
 if(!Array.isArray(input)||input.length>2||input.some(x=>typeof x!=='string'||x.trim().length<8||x.length>500))throw Error('one-or-two-queries-required');
 let values=[...new Set(input.map(x=>x.trim()))];
 if(!values.length){
  if(!entity.sector||!(entity.city||entity.country))throw Error('sector-location-or-query-required');
  values=[language==='en'?`Which businesses provide ${entity.sector} services in ${[entity.city,entity.country].filter(Boolean).join(', ')}? Explain your choices.`:`${[entity.city,entity.country].filter(Boolean).join(', ')} bölgesinde ${entity.sector} alanında hangi işletmeleri önerirsiniz? Seçim nedenlerinizi açıklayın.`];
 }
 return values.map(query=>({query,brandPrompted:brandMatch(query,entity)}));
}
export function answerObservation(entity,{provider,model,query,text,citations=[],responseId='',mode='api-no-search',complete=true,usage=null},checkedAt=new Date().toISOString()){
 if(typeof text!=='string'||!text.trim())throw Error('empty-provider-answer');
 const raw=text.slice(0,20000),truncated=text.length>20000||!complete;
 const seen=new Set(),sources=citations.filter(x=>x&&sourceUrl(x.url)).map(x=>({url:sourceUrl(x.url),title:String(x.title||'').slice(0,300)})).filter(x=>!seen.has(x.url)&&seen.add(x.url)).slice(0,30);
 return {provider,model,query,text:raw,checkedAt,responseId,mode,usage,truncated,brandPrompted:brandMatch(query,entity),brandMentioned:brandMatch(raw,entity),citations:sources,officialCitation:sources.some(x=>{try{const host=new URL(x.url).hostname.replace(/^www\./,''),d=new URL(/^https?:\/\//i.test(entity.domain)?entity.domain:'https://'+entity.domain).hostname.replace(/^www\./,'');return host===d||host.endsWith('.'+d)}catch{return false}})};
}
export function answerSummary(observations,errors=[]){
 const neutral=observations.filter(x=>!x.brandPrompted&&!x.truncated);
 return {successful:observations.length,failed:errors.length,neutralComplete:neutral.length,brandMentions:neutral.filter(x=>x.brandMentioned).length,officialCitations:neutral.filter(x=>x.officialCitation).length,prompted:observations.filter(x=>x.brandPrompted).length,incomplete:observations.filter(x=>x.truncated).length,scope:'Kaydedilen API yanıt örnekleri; genel AI görünürlüğü, sıralama veya satış olasılığı ölçümü değildir. Marka eşleşmesi tam ad veya alan adına göre yapılır. Kaynak içeriği ayrıca doğrulanmamıştır.'};
}
export function parsePerplexityAnswer(d){
 const blocks=(d.output||[]).filter(x=>x.type==='message').flatMap(x=>x.content||[]).filter(x=>x.type==='output_text');
 const text=blocks.map(x=>x.text||'').join('\n');
 const refs=new Set([...text.matchAll(/\[(\d+)\]/g)].map(x=>Number(x[1])));
 const searchCitations=(d.output||[]).filter(x=>x.type==='search_results').flatMap(x=>x.results||[]).filter(x=>refs.has(Number(x.id))).map(x=>({url:x.url,title:x.title}));
 const annotations=blocks.flatMap(x=>x.annotations||[]).filter(x=>x.type==='url_citation').map(x=>({url:x.url||x.url_citation?.url,title:x.title||x.url_citation?.title}));
 return {text,citations:[...annotations,...searchCitations],responseId:d.id||'',model:d.model||'',usage:d.usage||null,complete:d.status==='completed'};
}
