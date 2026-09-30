export const clients=[{id:"demo-1",name:"Demo Marka",domain:"example.com",plan:"Starter",status:"demo",visibilityScore:0,competitors:[]}];
export const scans=[];
export const agentJobs=[];
export function createScan(clientId,queries=[]){return {id:"scan-"+Date.now(),clientId,queries,status:"queued",createdAt:new Date().toISOString()}}
export function scoreVisibility(results=[]){if(!results.length)return 0;const hits=results.filter(x=>x.mentioned).length;return Math.round((hits/results.length)*100)}
export function executiveSummary({clientsCount=0,scansCount=0,approvals=0,mrr=0}={}){return {date:new Date().toISOString().slice(0,10),clientsCount,scansCount,approvals,mrr,message:`${clientsCount} müşteri · ${scansCount} tarama · $${mrr} MRR · ${approvals} onay bekliyor`}}
