async function readJson(fetcher,path,signal){
 const response=await fetcher(path,{cache:'no-store',signal});
 if(!response.ok)throw Error(response.status===401||response.status===403?'dashboard-session-required':'dashboard-unavailable');
 try{return await response.json()}catch{throw Error('dashboard-invalid-response')}
}
export async function readDashboardSnapshot(fetcher,signal){
 const [dashboard,scans,status]=await Promise.all(['/api/dashboard','/api/scans','/api/status'].map(path=>readJson(fetcher,path,signal)));
 const summary=dashboard?.summary;
 if(!summary||!['activeClients','scansToday','approvals'].every(key=>Number.isFinite(summary[key])&&summary[key]>=0)||!Array.isArray(summary.mrrByCurrency)||!summary.mrrByCurrency.every(x=>['TRY','USD','EUR','GBP'].includes(x.currency)&&Number.isFinite(x.amount)&&x.amount>=0)||!Array.isArray(dashboard.providers)||!Array.isArray(scans?.scans)||typeof status?.auth?.configured!=='boolean')throw Error('dashboard-invalid-response');
 return {summary,providers:dashboard.providers,scans:scans.scans,authReady:status.auth.configured};
}

export function measuredScans(scans=[]){
 return scans.filter(x=>x.status==='completed'&&x.score!==null&&x.score!==undefined&&String(x.score).trim()!==''&&Number.isFinite(Number(x.score))&&Number(x.score)>=0&&Number(x.score)<=100);
}
