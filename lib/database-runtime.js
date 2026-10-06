import {Pool} from 'pg';
const state=globalThis.__aiVisibilityDatabaseRuntime||(globalThis.__aiVisibilityDatabaseRuntime={pools:new Map(),schemas:new Map()});
export function databasePool(url){
 try{const parsed=new URL(url);if(["require","prefer","verify-ca"].includes(parsed.searchParams.get("sslmode")))parsed.searchParams.set("sslmode","verify-full");url=parsed.toString()}catch{}
 let pool=state.pools.get(url);
 if(!pool){pool=new Pool({connectionString:url,max:3,idleTimeoutMillis:30000,connectionTimeoutMillis:8000,statement_timeout:15000,query_timeout:20000,allowExitOnIdle:true});pool.on('error',()=>{});state.pools.set(url,pool)}
 return pool;
}
export async function initializeSchema(pool,key,ensure){
 let entries=state.schemas.get(pool);if(!entries){entries=new Map();state.schemas.set(pool,entries)}
 if(!entries.has(key)){
  const pending=(async()=>{const client=await pool.connect();try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(741852963)');await client.query('CREATE TABLE IF NOT EXISTS app_schema_migrations(schema_key TEXT PRIMARY KEY,version TEXT NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
   const version='2026-10-06.1';
   const current=(await client.query('SELECT version FROM app_schema_migrations WHERE schema_key=$1',[key])).rows[0]?.version;
   if(current!==version){await ensure(client);await client.query('INSERT INTO app_schema_migrations(schema_key,version) VALUES($1,$2) ON CONFLICT(schema_key) DO UPDATE SET version=EXCLUDED.version,updated_at=NOW()',[key,version])}
   await client.query('COMMIT')}catch(e){await client.query('ROLLBACK').catch(()=>{});throw e}finally{client.release()}})();
  entries.set(key,pending);pending.catch(()=>{if(entries.get(key)===pending)entries.delete(key)});
 }
 await entries.get(key);
}
