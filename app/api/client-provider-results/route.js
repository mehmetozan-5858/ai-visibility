import {cookies} from 'next/headers';
import {verifyClientToken} from '../../../lib/admin-auth';
import {getClientAccount} from '../../../lib/repository';
import {customerAccess} from '../../../lib/pilot-access';
import {resolveClientLaunchReadAccess} from '../../../lib/ai-visibility-client-launch-access.mjs';
import {databasePool} from '../../../lib/database-runtime';
import {getDatabaseUrl} from '../../../lib/db';
import {readCustomerComparisons} from '../../../lib/customer-comparison-reader.mjs';
const headers={'Cache-Control':'private, no-store, max-age=0','Pragma':'no-cache','Vary':'Cookie, Accept-Language'};
const json=(value,status=200)=>Response.json(value,{status,headers});
export async function GET(req){
 try{
  const store=await cookies(),session=await verifyClientToken(store.get('ai_client')?.value||'');
  if(!session)return json({error:'customer-session-required'},401);
  // No customer selector is accepted. The signed session defines the entire scope.
  if(new URL(req.url).search)return json({error:'customer-selectors-not-accepted'},400);
  const account=await getClientAccount(session.clientId);
  if(!account)return json({error:'customer-not-found'},404);
  const access=await customerAccess(account);
  if(!resolveClientLaunchReadAccess({session,account,access}).allowed)return json({error:'customer-access-denied'},403);
  const url=getDatabaseUrl();if(!url)return json({error:'results-unavailable'},503);
  return json(await readCustomerComparisons({pool:databasePool(url),clientId:session.clientId}));
 }catch{return json({error:'results-unavailable'},503);}
}
