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
export function wordpressObservation(response,workId,knownPostId){
 const rows=knownPostId?[response]:response;
 if(!Array.isArray(rows)||rows.length>1)throw Error('ambiguous-wordpress-response');
 if(!rows.length)return null;
 const post=rows[0];
 if(!Number.isSafeInteger(post?.id)||post.id<1||post.type!=='post'||!['draft','publish','pending','private','future'].includes(post.status))throw Error('invalid-wordpress-response');
 if(knownPostId?post.id!==Number(knownPostId):post.slug!=='aiv-'+workId)throw Error('wordpress-post-mismatch');
 return {postId:post.id,status:post.status==='publish'?'published-observed':post.status==='draft'?'draft-created':'editorial-review',published:post.status==='publish'};
}
