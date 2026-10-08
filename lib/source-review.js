import {contactPageUrl,readOfficialPage} from './contact-page-verification.js';
export function reviewInput(body){
 if(!Array.isArray(body?.reviews)||!body.reviews.length||body.reviews.length>10)throw Error('invalid-review-batch');
 const ids=new Set();return body.reviews.map(x=>{
  if(!/^[0-9a-f-]{36}$/i.test(x.id||'')||ids.has(x.id)||!Array.isArray(x.facts)||!x.facts.length||x.facts.length>5)throw Error('invalid-review');ids.add(x.id);
  return {id:x.id,facts:x.facts.map(f=>{if(typeof f.excerpt!=='string'||f.excerpt.trim().length<20||f.excerpt.length>500||typeof f.sourceUrl!=='string'||f.sourceUrl.length>2000)throw Error('invalid-fact');return {excerpt:f.excerpt.trim(),sourceUrl:f.sourceUrl}})};
 });
}
export function visibleText(html){return String(html).replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim()}
export async function verifySourceReview(x,prospect,{read=readOfficialPage}={}){
 const pages=new Map(),facts=[];
 for(const f of x.facts){const url=contactPageUrl(f.sourceUrl,prospect.domain).href;if(!pages.has(url))pages.set(url,visibleText((await read(url,prospect.domain,{timeout:5000,signal:AbortSignal.timeout(6000)})).html));
  if(!pages.get(url).toLowerCase().includes(f.excerpt.replace(/\s+/g,' ').toLowerCase()))throw Error('excerpt-not-on-official-page');facts.push({...f,sourceUrl:url});
 }
 return {method:'manual-source-review-v1',checkedAt:new Date().toISOString(),facts,scope:'Resmî sayfada yeniden bulunan alıntılar. AI görünürlük ölçümü veya eksiklik tespiti değildir.'};
}
