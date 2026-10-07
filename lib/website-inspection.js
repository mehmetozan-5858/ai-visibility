import {readOfficialPage} from './contact-page-verification.js';
import {remainingBudget} from './request-budget.js';

// Fixed checks on downloaded HTML, never model-authored verification claims.
export function inspectOfficialHtml({url,html},checkedAt=new Date().toISOString()){
 const clean=String(html).replace(/<!--[\s\S]*?-->/g,'').replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,'');
 const head=clean.match(/<head\b[^>]*>([\s\S]*?)<\/head\s*>/i)?.[1];
 if(head===undefined||!/<!doctype\s+html|<html\b/i.test(clean)||/captcha|verify you are human|just a moment|access denied|checking your browser/i.test(clean))throw Error('inspectable-html-required');
 const title=head.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1]?.replace(/<[^>]+>/g,'').trim();
 const description=[...head.matchAll(/<meta\b[^>]*>/gi)].some(([tag])=>/\bname\s*=\s*["']description["']/i.test(tag)&&/\bcontent\s*=\s*["'][^"']*[a-z0-9ğüşıöç][^"']*["']/i.test(tag));
 const scope='Yalnız bu sayfanın sunucudan alınan HTML yanıtı; JavaScript sonrası görünüm ve sitenin diğer sayfaları kontrol edilmedi.';
 return {method:'official-html-v1',status:'checked',sourceUrl:url,checkedAt,scope,checks:[
  {key:'html-title',present:!!title,text:title?'HTML sayfa başlığı mevcut.':'Alınan HTML sayfasında boş olmayan title etiketi bulunamadı.'},
  {key:'meta-description',present:description,text:description?'HTML meta description etiketi mevcut.':'Alınan HTML sayfasında boş olmayan meta description etiketi bulunamadı.'}
 ]};
}
export async function inspectProspectWebsite(prospect,{read=readOfficialPage}={}){
 try{
  const timeout=Math.floor(Math.min(5000,remainingBudget()));if(timeout<1000)throw Error('inspection-budget');
  const raw=/^https?:\/\//i.test(prospect.domain||'')?prospect.domain:'https://'+prospect.domain;
  return inspectOfficialHtml(await read(raw,prospect.domain,{timeout,signal:AbortSignal.timeout(timeout)}));
 }catch{return {method:'official-html-v1',status:'unavailable',checks:[],scope:'Resmî sayfanın HTML kontrolü tamamlanamadı; eksiklik sonucu çıkarılamaz.'}}
}
