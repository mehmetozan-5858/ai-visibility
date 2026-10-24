/**
 * Strict, bounded request parser for the disabled-by-default ZERA pilot write.
 * Never accepts arbitrary JSON fields or large bodies.
 */
const MAX_BYTES=512;
export async function parseZeraRegistrationRequest(req){
 if(!req?.headers||typeof req.headers.get!=="function")return {ok:false,reason:"invalid-request"};
 const type=req.headers.get("content-type")||"";
 if(!/^application\/json(?:\s*;\s*charset=utf-8)?\s*$/i.test(type))return {ok:false,reason:"invalid-content-type"};
 const length=req.headers.get("content-length");
 if(length!==null&&(!/^\d+$/.test(length)||Number(length)>MAX_BYTES))return {ok:false,reason:"request-too-large"};
 if(!req.body||typeof req.body.getReader!=="function")return {ok:false,reason:"invalid-request"};
 const reader=req.body.getReader(),chunks=[];
 let size=0;
 try{
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   if(!(value instanceof Uint8Array))return {ok:false,reason:"invalid-request"};
   size+=value.byteLength;
   if(size>MAX_BYTES){await reader.cancel().catch(()=>{});return {ok:false,reason:"request-too-large"};}
   chunks.push(value);
  }
 }catch{return {ok:false,reason:"invalid-request"}}
 finally{reader.releaseLock();}
 if(size===0)return {ok:false,reason:"invalid-request"};
 const bytes=new Uint8Array(size);let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 let body;
 try{body=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes))}
 catch{return {ok:false,reason:"invalid-request"}}
 if(!body||Array.isArray(body)||typeof body!=="object")return {ok:false,reason:"invalid-request"};
 const keys=Object.keys(body);
 if(keys.length!==2||!keys.includes("pilotId")||!keys.includes("confirmPublicPilot")||body.pilotId!=="ZERA-DE-001"||body.confirmPublicPilot!==true)
  return {ok:false,reason:"confirmation-required"};
 return {ok:true,pilotId:"ZERA-DE-001"};
}
