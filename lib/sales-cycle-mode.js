export function salesCycleMode({awaitingAnalysis=0,claimableTotal=0}={}){
 const backlog=Number(awaitingAnalysis)||0;
 const actionable=Number(claimableTotal)||0;
 return backlog>=50&&actionable>0?'backlog-preparation':'discovery-and-preparation';
}
