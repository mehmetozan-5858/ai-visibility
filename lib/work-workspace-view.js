export async function readWorkWorkspace(fetcher,signal){
 const response=await fetcher('/api/work-items',{cache:'no-store',signal});const data=await response.json();
 if(!response.ok)throw Error(data.error||'İş listesi yüklenemedi.');
 if(!Array.isArray(data.items)||data.items.some(x=>!x?.id||!x.clientId||!x.status))throw Error('İş listesi doğrulanamadı.');
 let deliveries={},deliveryError='';
 try{const response=await fetcher('/api/cms/drafts',{cache:'no-store',signal});const data=await response.json();
  if(!response.ok)throw Error(data.error||'Teslim kayıtları yüklenemedi.');
  if(!Array.isArray(data.deliveries)||data.deliveries.some(x=>!x?.workId))throw Error('Teslim kayıtları doğrulanamadı.');
  deliveries=Object.fromEntries(data.deliveries.map(x=>[x.workId,x]));
 }catch(e){if(e.name==='AbortError')throw e;deliveryError=e.message||'Teslim kayıtları yüklenemedi.';}
 return {items:data.items,deliveries,deliveryError};
}
