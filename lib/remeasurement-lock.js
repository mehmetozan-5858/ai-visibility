import {databasePool} from './database-runtime';
import {getDatabaseUrl} from './db';
export async function withRemeasurementLock(run,{pool}={}){
 if(!pool){const url=getDatabaseUrl();if(!url)throw Error('database-not-configured');pool=databasePool(url)}
 const tx=await pool.connect();let acquired=false,destroy=false;
 try{
  acquired=Boolean((await tx.query('SELECT pg_try_advisory_lock(741852969) AS acquired')).rows[0]?.acquired);
  if(!acquired)return {ok:true,skipped:'already-running'};
  return await run();
 }finally{
  if(acquired){try{await tx.query('SELECT pg_advisory_unlock(741852969)')}catch{destroy=true}}
  tx.release(destroy);
 }
}
