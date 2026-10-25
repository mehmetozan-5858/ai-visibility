import {databasePool} from './database-runtime';
import {getDatabaseUrl} from './db';
/** Store provider comparisons separately from scored scans. Never fabricate a rank/score. */
export async function storeCustomerComparison({clientId,comparison}){
 if(!getDatabaseUrl())throw Error('Database unavailable');
 if(!clientId||comparison?.clientId!==clientId)throw Error('Customer identity mismatch');
 if(!Array.isArray(comparison.results)||!comparison.results.length)throw Error('No provider results');
 const pool=databasePool(getDatabaseUrl());
 await pool.query(`CREATE TABLE IF NOT EXISTS ai_provider_comparisons(
   id UUID PRIMARY KEY,client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
   query TEXT NOT NULL,results JSONB NOT NULL,created_at TIMESTAMPTZ DEFAULT NOW())`);
 const {randomUUID}=await import('node:crypto');
 const id=randomUUID();
 await pool.query('INSERT INTO ai_provider_comparisons(id,client_id,query,results) VALUES($1,$2,$3,$4::jsonb)',
  [id,clientId,comparison.query,JSON.stringify(comparison.results)]);
 return {id,clientId,stored:true,visibilityScore:null};
}
