import {requireAdmin,checkRateLimit} from '../../../../lib/api-security';
import {databasePool} from '../../../../lib/database-runtime';
import {getDatabaseUrl} from '../../../../lib/db';
import {createZeraDiagnosticsHandler} from '../../../../lib/zera-readonly-diagnostics.mjs';
export const GET=createZeraDiagnosticsHandler({
 authorize:async req=>(await requireAdmin(req))||checkRateLimit(req,{bucket:'zera-readonly-diagnostics',limit:6,windowMs:60000}),
 getPool:()=>{const url=getDatabaseUrl();return url?databasePool(url):null},
 getSettings:()=>process.env,
});
