import {isIP} from 'node:net';
export function wordpressTarget(raw,clientDomain){
 const url=new URL(raw),domain=new URL(/^https?:\/\//i.test(clientDomain)?clientDomain:'https://'+clientDomain);
 if(url.protocol!=='https:'||url.username||url.password||url.port||url.search||url.hash||isIP(url.hostname)||url.hostname==='localhost'||url.hostname.endsWith('.local'))throw new Error('invalid-wordpress-site');
 if(url.hostname.replace(/^www\./,'')!==domain.hostname.replace(/^www\./,''))throw new Error('client-site-mismatch');
 return url.toString().replace(/\/$/,'');
}
export function draftContent(title,detail){
 const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 if(!String(detail||'').trim())throw new Error('empty-deliverable');
 return {title:String(title).slice(0,200),content:String(detail).slice(0,40000).split(/\n\s*\n/).map(x=>'<p>'+esc(x).replace(/\n/g,'<br/>')+'</p>').join(''),status:'draft'};
}
