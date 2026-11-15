import {replayCommandLedger,nextLedgerRecord} from './agent-command-ledger.js';

// Caller supplies an authenticated pg-compatible pool. Schema installation is separate.
// All operations use the same table lock, including reads, so multi-host writers serialize.
export function createPostgresCommandControl(pool,{clock=()=>new Date().toISOString()}={}){
 if(typeof pool?.connect!=='function')throw Error('database-pool-required');
 async function transaction(fn){
  const client=await pool.connect();let begun=false,releaseError;
  try{
   await client.query('BEGIN');begun=true;
   await client.query("SET LOCAL lock_timeout = '5s'");
   await client.query("SET LOCAL statement_timeout = '10s'");
   await client.query('LOCK TABLE public.agent_command_ledger IN EXCLUSIVE MODE');
   const {rows}=await client.query('SELECT sequence,operation,previous_hash,hash FROM public.agent_command_ledger ORDER BY sequence LIMIT 10001');
   const state=replayCommandLedger(rows);
   const result=await fn(state,client);
   await client.query('COMMIT');begun=false;return result;
  }catch(error){
   if(begun)try{await client.query('ROLLBACK');}catch(rollbackError){releaseError=rollbackError;}
   throw error;
  }finally{client.release(releaseError);}
 }
 async function append(state,client,operation){
  const record=nextLedgerRecord(state,operation);
  await client.query('INSERT INTO public.agent_command_ledger(sequence,operation,previous_hash,hash) VALUES ($1,$2,$3,$4)',
   [record.sequence,record.operation,record.previousHash,record.hash]);
 }
 return Object.freeze({
  async enqueue(input,principal){return transaction(async(state,client)=>{
   const at=clock();state.setClock(at);
   const result=state.control.enqueue(input,principal);
   const task={id:input.id,tenantId:input.tenantId,project:input.project,action:input.action};
   await append(state,client,{kind:'enqueue',task,actorId:principal.actorId,at});return result;
  });},
  async review(taskId,gates,principal){return transaction(async(state,client)=>{
   const task=state.control.snapshot(principal).tasks.find(t=>t.id===taskId);
   if(!task)throw Error('unknown-or-forbidden-task');
   const at=clock();state.setClock(at);
   const result=state.control.review(taskId,gates,principal);
   const input={id:task.id,tenantId:task.tenantId,project:task.project,action:task.action};
   await append(state,client,{kind:'review',task:input,gates:structuredClone(gates),actorId:principal.actorId,at});return result;
  });},
  async snapshot(principal){return transaction(state=>{
   const snapshot=state.control.snapshot(principal);
   return {...snapshot,storage:'postgresql',durable:true,ledgerEntries:snapshot.audit.length};
  });}
 });
}
