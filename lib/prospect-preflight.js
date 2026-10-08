import {contactPageUrl,readOfficialPage,pageContainsAddress} from './contact-page-verification.js';
import {inspectOfficialHtml} from './website-inspection.js';
import {recipientScopeIssue} from './recipient-scope.js';
const emailPattern=/[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
export function officialEmails(html,domain){
 const host=contactPageUrl('https://'+String(domain).replace(/^https?:\/\//,'').split('/')[0],domain).hostname.replace(/^www\./,'');
 const visible=String(html).replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'').replace(/&#64;|&#x40;|&commat;/gi,'@').replace(/&#46;|&#x2e;|&period;/gi,'.');
 return [...new Set((visible.match(emailPattern)||[]).map(x=>x.toLowerCase()))].filter(email=>{const h=email.split('@')[1];return(h===host||h.endsWith('.'+host))&&pageContainsAddress(visible,email)}).sort((a,b)=>Number(!/^(info|sales|contact|office|hello|enquiry)@/.test(a))-Number(!/^(info|sales|contact|office|hello|enquiry)@/.test(b)));
}
export function contactLinks(html,base,domain){
 const links=[];
 for(const match of String(html).matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
  if(!/contact|kontakt|iletisim|iletişim|impressum|contatti|contato|bize ulaş/i.test(match[1]+' '+match[2]))continue;
  try{const u=contactPageUrl(new URL(match[1].replace(/&amp;/g,'&'),base).href,domain);u.hash='';if(!links.includes(u.href))links.push(u.href)}catch{}
 }
 return links.slice(0,2);
}
// No AI calls, guessed addresses or directory sources. Stored inspection is narrow HTML evidence.
export async function preflightProspect(x,{read=readOfficialPage}={}){
 const origin=contactPageUrl(/^https:\/\//i.test(x.domain)?x.domain:'https://'+x.domain,x.domain).href;
 const pages=[...new Set([x.contactSourceUrl,origin].filter(Boolean))];let inspection=null,lastError='',readCount=0;const visited=new Set();
 while(pages.length&&readCount<3){
  const url=pages.shift();if(visited.has(url))continue;visited.add(url);try{
   contactPageUrl(url,x.domain);readCount++;
   const page=await read(url,x.domain,{timeout:5000,signal:AbortSignal.timeout(6000)});
   const evidence=inspectOfficialHtml(page);inspection ||= evidence;
   const published=officialEmails(page.html,x.domain);
   const emails=published.filter(email=>!recipientScopeIssue({...x,contactEmail:email,contactSourceUrl:page.url}));
   if(published.length&&!emails.length)lastError='contact-scope-review-required';
   const preferred=emails.find(e=>e===String(x.contactEmail||'').toLowerCase())||emails[0];
   if(preferred)return {inspection,contact:{email:preferred,sourceUrl:page.url,contactUrl:page.url,status:'verified'},pagesChecked:readCount};
   for(const link of contactLinks(page.html,page.url,x.domain))if(!pages.includes(link)&&link!==page.url)pages.push(link);
  }catch(e){lastError=e.message==='inspectable-html-required'?'official-page-not-inspectable':'official-page-unavailable'}
 }
 return {inspection,contact:{status:'not-found',email:'',sourceUrl:''},pagesChecked:readCount,reason:lastError||'official-email-not-found'};
}

