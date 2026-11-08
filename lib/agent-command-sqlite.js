import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {chmodSync} from 'node:fs';
import {createCommandControl} from './agent-command-control.js';

const hash=record=>createHash('sha256').update(JSON.stringify(record)).digest('hex');

// Local, single-host durable adapter. Not for Vercel's ephemeral filesystem.
// Each operation replays and validates the ledger within a SQLite transaction.
export function openDurableCommandControl(path,{clock=()=>new Date().toISOString()}={}){
 if(typeof path!=='string' || !path || path===':memory:')throw Error('durable-path-required');
 const db=new DatabaseSync(path);
 try{
  chmodSync(path,0o600);
  db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
  db.exec('BEGIN IMMEDIATE');
  const version=db.prepare('PRAGMA user_version').get().user_version;
  if(version===0){
   if(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().length)throw Error('unrecognized-store');
   db.exec(`CREATE TABLE command_ledger (
    sequence INTEGER PRIMARY KEY, operation TEXT NOT NULL,
    previous_hash TEXT, hash TEXT NOT NULL UNIQUE
   ); PRAGMA user_version=1;`);
  }else if(version!==1)throw Error('unsupported-store-version');
  db.exec('COMMIT');
 }catch(error){try{db.exec('ROLLBACK');}catch{}db.close();throw error;}
 let closed=false;
 function replay(){
  const rows=db.prepare('SELECT * FROM command_ledger ORDER BY sequence LIMIT 10001').all();
  if(rows.length>10000)throw Error('ledger-capacity-reached');
  let at,previousHash=null;
  const control=createCommandControl({clock:()=>at});
  for(const [index,row] of rows.entries()){
   if(row.sequence!==index+1 || row.previous_hash!==previousHash)throw Error('ledger-integrity-failed');
   const record={sequence:row.sequence,operation:row.operation,previousHash:row.previous_hash};
   if(hash(record)!==row.hash)throw Error('ledger-integrity-failed');
   let op;try{op=JSON.parse(row.operation);}catch{throw Error('ledger-integrity-failed');}
   at=op.at;
   const principal={authenticated:true,actorId:op.actorId,tenantId:op.task?.tenantId,
    projects:[op.task?.project],actions:[op.task?.action]};
   try{
    if(op.kind==='enqueue')control.enqueue(op.task,principal);
    else if(op.kind==='review'){
     const prior=control.snapshot(principal).tasks.find(t=>t.id===op.task.id);
     if(!prior || ['id','tenantId','project','action'].some(k=>prior[k]!==op.task[k]))throw Error('task-mismatch');
     control.review(op.task.id,op.gates,principal);
    }else throw Error('unknown-operation');
   }catch{throw Error('ledger-integrity-failed');}
   previousHash=row.hash;
  }
  return {control,rows,previousHash,setClock:value=>{at=value;}};
 }
 function transaction(fn,write=false){
  if(closed)throw Error('store-closed');
  db.exec(write?'BEGIN IMMEDIATE':'BEGIN');
  try{const result=fn(replay());db.exec('COMMIT');return result;}
  catch(error){db.exec('ROLLBACK');throw error;}
 }
 function append(state,operation){
  if(state.rows.length>=10000)throw Error('ledger-capacity-reached');
  const record={sequence:state.rows.length+1,operation:JSON.stringify(operation),previousHash:state.previousHash};
  db.prepare('INSERT INTO command_ledger(sequence,operation,previous_hash,hash) VALUES (?,?,?,?)')
   .run(record.sequence,record.operation,record.previousHash,hash(record));
 }
 // Fail closed at startup if persisted state cannot be replayed.
 try{transaction(()=>null);}catch(error){db.close();throw error;}
 return Object.freeze({
  enqueue(input,principal){
   return transaction(state=>{
    const at=clock();
    state.setClock(at);
    state.control.enqueue(input,principal);
    const task={id:input.id,tenantId:input.tenantId,project:input.project,action:input.action};
    append(state,{kind:'enqueue',task,actorId:principal.actorId,at});
    return {...task,state:'queued'};
   },true);
  },
  review(taskId,gates,principal){
   return transaction(state=>{
    const at=clock();
    const task=state.control.snapshot(principal).tasks.find(t=>t.id===taskId);
    if(!task)throw Error('unknown-or-forbidden-task');
    const input={id:task.id,tenantId:task.tenantId,project:task.project,action:task.action};
    state.setClock(at);
    const result=state.control.review(taskId,gates,principal);
    append(state,{kind:'review',task:input,gates:structuredClone(gates),actorId:principal.actorId,at});
    return result;
   },true);
  },
  snapshot(principal){return transaction(state=>{
   const snapshot=state.control.snapshot(principal);
   return {...snapshot,storage:'sqlite-local',durable:true,ledgerEntries:snapshot.audit.length};
  });},
  close(){if(!closed){db.close();closed=true;}}
 });
}
