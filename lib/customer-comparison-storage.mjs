import {writeCustomerComparison} from './customer-comparison-write.mjs';
import {prepareCustomerComparisonStorage} from './customer-comparison-schema.mjs';
import {databasePool} from './database-runtime';
import {getDatabaseUrl} from './db';
/** Store provider comparisons separately from scored scans. Never fabricate a rank/score. */
export async function storeCustomerComparison({clientId,comparison,attemptTaskId}){
 if(!getDatabaseUrl())throw Error('Database unavailable');
 if(!clientId||comparison?.clientId!==clientId)throw Error('Customer identity mismatch');
 if(!Array.isArray(comparison.results)||!comparison.results.length)throw Error('No provider results');
 const pool=databasePool(getDatabaseUrl());
 await prepareCustomerComparisonStorage(pool,clientId);
 return writeCustomerComparison(pool,{clientId,comparison,attemptTaskId});
}
