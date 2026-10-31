import {requireAdmin,enforceSameOrigin,checkRateLimit} from '../../../../lib/api-security';
import {databasePool} from '../../../../lib/database-runtime';
import {getDatabaseUrl} from '../../../../lib/db';
import {createZeraLivePreflight} from '../../../../lib/zera-live-preflight.mjs';
export const runtime='nodejs';
const handlers=createZeraLivePreflight({authorize:requireAdmin,
 guard:async req=>enforceSameOrigin(req)||checkRateLimit(req,{bucket:'zera-preflight',limit:6,windowMs:600000}),
 getPool:()=>{const url=getDatabaseUrl();if(!url)throw Error('database-not-configured');return databasePool(url)},getSettings:()=>process.env});
export const GET=handlers.GET;
export const POST=handlers.POST;
