/** Compare the browser Origin with the inbound host and proxy transport.
 * Next's internal URL hostname may differ from the actual request Host.
 */
export function hasSameArgeOrigin(req){
 try{
  const raw=req.headers.get('origin'),origin=new URL(raw);
  const transport=req.headers.get('x-forwarded-proto')||new URL(req.url).protocol.slice(0,-1);
  return ['http','https'].includes(transport)&&origin.origin===raw&&
   origin.host===req.headers.get('host')&&origin.protocol===transport+':';
 }catch{return false;}
}
