import {cookies} from 'next/headers';
import {verifyClientToken} from '../../../../../lib/admin-auth';
import {enforceSameOrigin,checkRateLimit} from '../../../../../lib/api-security';
import {getClientAccount} from '../../../../../lib/repository';
import {customerAccess} from '../../../../../lib/pilot-access';
import {databasePool} from '../../../../../lib/database-runtime';
import {getDatabaseUrl} from '../../../../../lib/db';
import {buildReportResponse} from '../../../../../lib/report-pdf';
import {readCustomerComparisonReport} from '../../../../../lib/customer-comparison-report.mjs';
import {reportRecipient,createCustomerReportEmailHandler} from '../../../../../lib/customer-report-delivery.mjs';
import {deliverOnce} from '../../../../../lib/email-delivery';
export const runtime='nodejs';
export const POST=createCustomerReportEmailHandler({
 authorize:async()=>verifyClientToken((await cookies()).get('ai_client')?.value||''),
 guard:async req=>enforceSameOrigin(req)||checkRateLimit(req,{bucket:'customer-report-email',limit:3,windowMs:600000}),
 getAccount:getClientAccount,getAccess:customerAccess,getPool:()=>databasePool(getDatabaseUrl()),
 getRecipient:reportRecipient,readComparisons:readCustomerComparisonReport,buildReport:buildReportResponse,
 deliver:deliverOnce,settings:()=>process.env,
});
