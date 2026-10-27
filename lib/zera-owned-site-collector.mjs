// Bounded, first-party-only source collector. Not a Google SERP scanner.
export const ZERA_OWNED_SITE='https://ze-ra.de/';
export async function collectZeraOwnedSite({fetchImpl=fetch}={}){
 const response=await fetchImpl(ZERA_OWNED_SITE,{method:'GET',redirect:'manual',headers:{accept:'text/html'},signal:AbortSignal.timeout(8000)});
 if(!response.ok||response.status>=300||response.headers.get('content-type')?.toLowerCase().includes('text/html')!==true)
  return {status:'unavailable',verified:false};
 const reader=response.body?.getReader();
 if(!reader)return {status:'unavailable',verified:false};
 const decoder=new TextDecoder();let html='',bytes=0;
 try{
  while(true){
   const part=await reader.read();if(part.done)break;
   bytes+=part.value.byteLength;
   if(bytes>65536)return {status:'oversize',verified:false};
   html+=decoder.decode(part.value,{stream:true});
  }
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
 const title=(html.match(/<title[^>]*>([^<]{1,200})<\/title>/i)?.[1]||'').replace(/\s+/g,' ').trim();
 return {status:'collected',sourceUrl:ZERA_OWNED_SITE,title,verified:false,channel:'owned-site',googleRank:null};
}
