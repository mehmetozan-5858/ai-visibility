import {createHash} from 'node:crypto';

const projects=Object.freeze(['ai-visibility','global-broker-ai','future-signal-studio']);
const actions=Object.freeze(['acceptance.review']);
const id=value=>typeof value==='string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function commandControlStatus(){
 return {mode:'offline-review',projects:[...projects],actions:[...actions],
  providerExecution:false,externalWrites:false,paidUsage:false,
  bridgeInference:'not-connected',storage:'process-memory',
  releaseReady:false};
}

// Principal must come from a trusted server identity resolver, never a request body.
// No tokens, prompts, answers or customer payloads are copied into the audit log.
export function createCommandControl({clock=()=>new Date().toISOString()}={}){
 const tasks=new Map(),events=[];
 function authorize(principal,task){
  if(!principal || principal.authenticated!==true || !id(principal.actorId) ||
   !id(principal.tenantId) || principal.tenantId!==task.tenantId ||
   !Array.isArray(principal.projects) || !principal.projects.includes(task.project) ||
   !Array.isArray(principal.actions) || !principal.actions.includes(task.action)) throw Error('forbidden');
 }
 function record(task,state,actorId){
  const at=clock();
  if(typeof at!=='string' || !Number.isFinite(Date.parse(at))) throw Error('invalid-clock');
  const event={sequence:events.length+1,taskId:task.id,project:task.project,
   tenantId:task.tenantId,actorId,state,at,previousHash:events.at(-1)?.hash||null};
  const next={...task,state};
  events.push(Object.freeze({...event,hash:digest(event)}));
  tasks.set(task.id,next);
  return structuredClone(next);
 }
 return Object.freeze({
  enqueue(input,principal){
   if(!input || typeof input!=='object' || Array.isArray(input) ||
    Object.keys(input).some(key=>!['id','tenantId','project','action'].includes(key)) ||
    !id(input.id) || !id(input.tenantId) || !projects.includes(input.project) ||
    !actions.includes(input.action)) throw Error('invalid-task');
   const task={id:input.id,tenantId:input.tenantId,project:input.project,action:input.action};
   authorize(principal,task);
   if(tasks.has(task.id)) throw Error('duplicate-task');
   return record(task,'queued',principal.actorId);
  },
  review(taskId,gates,principal){
   const task=tasks.get(taskId);
   if(!task) throw Error('unknown-task');
   authorize(principal,task);
   if(task.state!=='queued') throw Error('invalid-transition');
   if(!Array.isArray(gates) || gates.length===0 || gates.length>100 ||
    gates.some(g=>!g || Object.keys(g).some(k=>!['id','status'].includes(k)) ||
     !id(g.id) || !['verified','pending','unknown','blocked'].includes(g.status)) ||
    new Set(gates.map(g=>g.id)).size!==gates.length) throw Error('invalid-gates');
   // These are caller-reported statuses, not independently verified evidence.
   const openGateIds=gates.filter(g=>g.status!=='verified').map(g=>g.id);
   const result={reviewStatus:openGateIds.length?'needs-evidence':'reported-complete',
    openGateIds,independentlyVerified:false,releaseAuthorized:false};
   return record({...task,result},'reviewed',principal.actorId);
  },
  snapshot(principal){
   if(!principal || principal.authenticated!==true || !id(principal.actorId) || !id(principal.tenantId)) throw Error('forbidden');
   const visible=[...tasks.values()].filter(task=>{
    try{authorize(principal,task);return true;}catch{return false;}
   });
   const ids=new Set(visible.map(t=>t.id));
   return structuredClone({tasks:visible,audit:events.filter(e=>ids.has(e.taskId)),
    auditScope:'tenant-project-subset',...commandControlStatus()});
  }
 });
}
