import {lookup} from 'node:dns/promises';
import {isIP,BlockList} from 'node:net';
import {request} from 'node:https';
const blocked=new BlockList();
for(const [ip,prefix] of [['0.0.0.0',8],['10.0.0.0',8],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.168.0.0',16],['100.64.0.0',10],['224.0.0.0',4],['240.0.0.0',4]])blocked.addSubnet(ip,prefix,'ipv4');
export function publicAddress(address){return isIP(address)===4&&!blocked.check(address,'ipv4')}
export function contactPageUrl(raw,domain){
 const u=new URL(raw),official=new URL(/^https?:\/\//i.test(domain)?domain:'https://'+domain).hostname.replace(/^www\./,'').toLowerCase(),h=u.hostname.toLowerCase().replace(/^www\./,'');
 if(u.protocol!=='https:'||u.username||u.password||u.port||isIP(h)||!h.includes('.')||h.endsWith('.local')||!(h===official||h.endsWith('.'+official)))throw Error('invalid-official-contact-page');return u;
}
export function pageContainsAddress(text,email){
 const plain=String(text).replace(/&#64;|&#x40;|&commat;/gi,'@').replace(/&#46;|&#x2e;|&period;/gi,'.').toLowerCase();
 return plain.split(/[^a-z0-9.!#$%&'*+\/=?^_`{|}~@-]+/i).includes(String(email).toLowerCase())||plain.includes('mailto:'+String(email).toLowerCase()+'\"');
}
async function page(u){
 const addresses=await lookup(u.hostname,{all:true,family:4});if(!addresses.length||addresses.some(x=>!publicAddress(x.address)))throw Error('non-public-contact-page');
 const target=addresses[0];
 return await new Promise((resolve,reject)=>{
  const req=request(u,{headers:{'user-agent':'AIVisibilityWorks/1.0 Contact Verification','accept':'text/html'},lookup:(hostname,options,cb)=>options.all?cb(null,[target]):cb(null,target.address,target.family)},res=>{
   let body='',size=0;res.on('data',chunk=>{size+=chunk.length;if(size>512000){req.destroy(Error('contact-page-too-large'));return}body+=chunk.toString()});res.on('end',()=>resolve({status:res.statusCode,location:res.headers.location,body}));res.on('error',reject);
  });req.setTimeout(8000,()=>req.destroy(Error('contact-page-timeout')));req.on('error',reject);req.end();
 });
}
export async function verifyContactPage(raw,email,domain){
 let u=contactPageUrl(raw,domain);
 for(let i=0;i<3;i++){const r=await page(u);if(r.status>=300&&r.status<400&&r.location){u=contactPageUrl(new URL(r.location,u).href,domain);continue}return r.status===200&&pageContainsAddress(r.body,email)}return false;
}
