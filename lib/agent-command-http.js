// Review commands only; this handler never dispatches models or external actions.
export function createAgentCommandHandler({enabled,resolvePrincipal,getControl}){
 return async function POST(req){
  const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
  if(!enabled())return reply({ok:false,error:'command-control-unavailable'},503);
  const header=req.headers.get('authorization')||'';
  if(!/^Bearer [A-Za-z0-9_.-]{1,4096}$/.test(header))return reply({ok:false,error:'unauthorized'},401);
  let principal;
  try{principal=await resolvePrincipal(header.slice(7));}
  catch(error){return reply({ok:false,error:error.message==='invalid-agent-token'?'unauthorized':'command-control-unavailable'},error.message==='invalid-agent-token'?401:503);}
  if(req.headers.get('content-type')?.split(';')[0].trim()!=='application/json')return reply({ok:false,error:'invalid-request'},400);
  let input;
  try{
   const reader=req.body?.getReader();if(!reader)throw Error();
   let size=0;const chunks=[];
   try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;
    if(size>65536){await reader.cancel();return reply({ok:false,error:'request-too-large'},413);}chunks.push(value);}}
   finally{reader.releaseLock();}
   input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   if(!input || typeof input!=='object' || Array.isArray(input))throw Error();
   const fields=input.operation==='enqueue'?['operation','task']:input.operation==='review'?['operation','taskId','gates']:null;
   if(!fields || Object.keys(input).some(k=>!fields.includes(k)))throw Error();
  }catch{return reply({ok:false,error:'invalid-request'},400);}
  try{
   const control=await getControl();
   const task=input.operation==='enqueue'?await control.enqueue(input.task,principal):await control.review(input.taskId,input.gates,principal);
   return reply({ok:true,task,providerExecuted:false,releaseAuthorized:false});
  }catch(error){
   if(['forbidden','unknown-or-forbidden-task'].includes(error.message))return reply({ok:false,error:'forbidden'},403);
   if(['duplicate-task','invalid-transition'].includes(error.message))return reply({ok:false,error:'task-conflict'},409);
   if(['invalid-task','invalid-gates','unknown-task'].includes(error.message))return reply({ok:false,error:'invalid-request'},400);
   return reply({ok:false,error:'command-control-unavailable'},503);
  }
 };
}
