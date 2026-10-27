import {resolveClientLaunchReadAccess} from './ai-visibility-client-launch-access.mjs';
import {createStoredRevenuePreview,createStoredReleasePreview} from './arge-report-repository.mjs';
import {hasSameArgeOrigin} from './arge-request-origin.mjs';
/** Dependencies are server composition only; never request-controlled. */
export function createAuditPreviewHandler({getSession,getSettings,getClientAccount,customerAccess,getDatabaseUrl,databasePool,reportKind='revenue-integrity',fetchGithub=fetch}){
if(!['revenue-integrity','release-assurance'].includes(reportKind))throw Error('unsupported-report-kind');
const headers={'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie'};
const json=(value,status=200)=>Response.json(value,{status,headers});
return async function POST(req){
 try{
  const session=await getSession(req);
  if(!session)return json({error:'session-required'},401);
  // Two explicit server flags; never accepted from request JSON.
  const settings=getSettings();
  const featureEnabled=settings.ARGE_REPORT_PREVIEW_ENABLED==='true'&&
   (reportKind!=='release-assurance'||settings.ARGE_RELEASE_PREVIEW_ENABLED==='true');
  const globallyEnabled=settings.ARGE_AUDIT_SERVICE_ENABLED==='true';
  if(!featureEnabled||!globallyEnabled)return json({error:'preview-disabled'},403);
  if(!hasSameArgeOrigin(req)||
     req.headers.get('content-type')?.split(';')[0].trim()!=='application/json')return json({error:'invalid-origin-or-content-type'},403);
  const reader=req.body?.getReader();if(!reader)return json({error:'invalid-request'},400);
  let bytes=0,chunks=[];
  try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;
   if(bytes>2048){await reader.cancel();return json({error:'request-too-large'},413);}chunks.push(value);}}
  finally{reader.releaseLock();}
  let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return json({error:'invalid-json'},400);}
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>k!=='requestId')||
     typeof body.requestId!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(body.requestId))return json({error:'invalid-request'},400);
  const account=await getClientAccount(session.clientId),access=await customerAccess(account);
  if(!resolveClientLaunchReadAccess({session,account,access}).allowed)return json({error:'access-denied'},403);
  const url=getDatabaseUrl();if(!url)return json({error:'storage-unavailable'},503);
  const create=reportKind==='release-assurance'?createStoredReleasePreview:createStoredRevenuePreview;
  const result=await create({pool:databasePool(url),session,accountClientId:account.client.id,
   requestId:body.requestId,featureEnabled,globallyEnabled,
   ...(reportKind==='release-assurance'?{targetSha:settings.ARGE_RELEASE_TARGET_SHA,rollbackSha:settings.ARGE_RELEASE_ROLLBACK_SHA,fetchImpl:fetchGithub}:{})});
  return result.ok?json(result):json({error:result.reason},result.reason==='preview-daily-limit'?429:403);
 }catch{return json({error:'preview-unavailable'},503);}
}
}
