import {provisionalScore} from './scan-workspace.js';

export function accountScanEstimates(scans,now=Date.now()){
 const rows=(Array.isArray(scans)?scans:[]).filter(x=>{
  const at=Date.parse(x?.completedAt||x?.createdAt||'');
  return x?.status==='completed'&&typeof x.score!=='boolean'&&provisionalScore(x.score)!=='—'&&Number.isFinite(at)&&at<=now;
 }).sort((a,b)=>Date.parse(a.completedAt||a.createdAt)-Date.parse(b.completedAt||b.createdAt));
 return {first:rows[0]||null,latest:rows.at(-1)||null,count:rows.length};
}
export async function readClientAccount(fetcher,clientId,signal){
 const r=await fetcher('/api/client-activity?clientId='+encodeURIComponent(clientId),{cache:'no-store',signal});
 if(!r.ok)throw Error([401,403].includes(r.status)?'Oturum gerekli. Yeniden giriş yapın.':'İşletme hesabı okunamadı.');
 const d=await r.json();
 if(d.account?.client?.id!==clientId||!['scans','activity','payments'].every(k=>Array.isArray(d.account[k])))throw Error('İşletme hesabı doğrulanamadı.');
 return d.account;
}
export function recordedEstimateDelta(value){
 if(value===null||value===undefined||typeof value==='boolean'||String(value).trim()===''||!Number.isFinite(Number(value))||Math.abs(Number(value))>100)return null;
 return `Ön puan farkı: ${Number(value)>0?'+':''}${Number(value)} (tahmin)`;
}
