import {createHash} from 'node:crypto';
import {createCommandControl} from './agent-command-control.js';

export const ledgerHash=record=>createHash('sha256').update(JSON.stringify(record)).digest('hex');
export function nextLedgerRecord(state,operation){
 if(state.rows.length>=10000)throw Error('ledger-capacity-reached');
 const record={sequence:state.rows.length+1,operation:JSON.stringify(operation),previousHash:state.previousHash};
 return {...record,hash:ledgerHash(record)};
}
export function replayCommandLedger(rows){
 if(rows.length>10000)throw Error('ledger-capacity-reached');
 let at,previousHash=null;
 const control=createCommandControl({clock:()=>at});
 for(const [index,row] of rows.entries()){
  if(row.sequence!==index+1 || row.previous_hash!==previousHash)throw Error('ledger-integrity-failed');
  const record={sequence:row.sequence,operation:row.operation,previousHash:row.previous_hash};
  if(ledgerHash(record)!==row.hash)throw Error('ledger-integrity-failed');
  try{
   const op=JSON.parse(row.operation);
   at=op.at;
   const principal={authenticated:true,actorId:op.actorId,tenantId:op.task?.tenantId,
    projects:[op.task?.project],actions:[op.task?.action]};
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
