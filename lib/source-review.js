import {contactPageUrl,readOfficialPage} from './contact-page-verification.js';
export function reviewInput(body){
 if(!Array.isArray(body?.reviews)||!body.reviews.length||body.reviews.length>10)throw Error('invalid-review-batch');
 const ids=new Set();return body.reviews.map(x=>{
  if(!/^[0-9a-f-]{36}$/i.test(x.id||'')||ids.has(x.id)||!Array.isArray(x.facts)||!x.facts.length||x.facts.length>5)throw Error('invalid-review');ids.add(x.id);
  const assessment=assessmentInput(x.assessment,x.facts.length);
  return {id:x.id,...(assessment?{assessment}:{}),facts:x.facts.map(f=>{if(typeof f.excerpt!=='string'||f.excerpt.trim().length<20||f.excerpt.length>500||typeof f.sourceUrl!=='string'||f.sourceUrl.length>2000)throw Error('invalid-fact');return {excerpt:f.excerpt.trim(),sourceUrl:f.sourceUrl}})};
 });
}
export function visibleText(html){return String(html).replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim()}
export async function verifySourceReview(x,prospect,{read=readOfficialPage}={}){
 const pages=new Map(),facts=[];
 for(const f of x.facts){const url=contactPageUrl(f.sourceUrl,prospect.domain).href;if(!pages.has(url))pages.set(url,visibleText((await read(url,prospect.domain,{timeout:5000,signal:AbortSignal.timeout(6000)})).html));
  if(!pages.get(url).toLowerCase().includes(f.excerpt.replace(/\s+/g,' ').toLowerCase()))throw Error('excerpt-not-on-official-page');facts.push({...f,sourceUrl:url});
 }
 return {method:x.assessment?'manual-source-review-v2':'manual-source-review-v1',checkedAt:new Date().toISOString(),facts,...(x.assessment?{assessment:assessmentInput(x.assessment,facts.length),assessmentScope:'Kaynaklara bağlı inceleyici değerlendirmesi; sağlayıcı ölçümü veya doğrulanmış sonuç değildir.'}:{}),scope:'Resmî sayfada yeniden bulunan alıntılar. AI görünürlük ölçümü veya eksiklik tespiti değildir.'};
}

// Reviewer judgement stays separate from literal, server-verified source facts.
export function assessmentInput(value,factCount){
 if(value===undefined)return null;
 if(!value||!['prepare','needs-review'].includes(value.decision))throw Error('invalid-assessment');
 const bounded=(items,label)=>{if(!Array.isArray(items)||items.length<1||items.length>5)throw Error('invalid-'+label);return items.map(item=>{
  if(typeof item.text!=='string'||item.text.trim().length<12||item.text.length>600||!Array.isArray(item.factIndexes)||!item.factIndexes.length||item.factIndexes.length>5||item.factIndexes.some(i=>!Number.isInteger(i)||i<0||i>=factCount))throw Error('invalid-'+label);
  return {text:item.text.trim(),factIndexes:[...new Set(item.factIndexes)],...(label==='findings'?{kind:'reviewer-inference'}:{})};
 })};
 if(!Array.isArray(value.uncertainties)||value.uncertainties.length>5||value.uncertainties.some(x=>typeof x!=='string'||x.trim().length<12||x.length>600))throw Error('invalid-uncertainty');
 return {decision:value.decision,findings:bounded(value.findings,'findings'),actions:bounded(value.actions,'actions'),uncertainties:value.uncertainties.map(x=>x.trim())};
}
export function reviewedGuidance(review){
 if(review?.method!=='manual-source-review-v2'||!Array.isArray(review.facts)||!review.facts.length)return null;
 try{return {...assessmentInput(review.assessment,review.facts.length),checkedAt:review.checkedAt,scope:'Kaynaklı inceleyici değerlendirmesi; AI skoru değildir.'}}catch{return null}
}
