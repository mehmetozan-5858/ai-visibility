import {cookies} from 'next/headers';
import {verifyClientToken} from '../../../lib/admin-auth';
import {getClientAccount} from '../../../lib/repository';
import {customerAccess} from '../../../lib/pilot-access';
import {databasePool} from '../../../lib/database-runtime';
import {getDatabaseUrl} from '../../../lib/db';
import {createAuditPreviewHandler} from '../../../lib/audit-preview-handler.mjs';
export const POST=createAuditPreviewHandler({
 getSession:async()=>{const store=await cookies();return verifyClientToken(store.get('ai_client')?.value||'');},
 getSettings:()=>process.env,getClientAccount,customerAccess,getDatabaseUrl,databasePool,
});
