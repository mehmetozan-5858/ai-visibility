export const isBlockedWork=item=>['access-required','approval-required'].includes(item.status);
export function workBlocker(item,now=Date.now()){
 const timestamp=new Date(item.updatedAt||item.createdAt).getTime();
 const days=Number.isFinite(timestamp)?Math.max(0,Math.floor((now-timestamp)/86400000)):null;
 const access=item.status==='access-required';
 return {days,reason:access?'Uygulama için dış sisteme erişim gerekiyor.':'Uygulama için müşteri kararı veya bilgi doğrulaması gerekiyor.',required:item.detail||`${item.title} için ${access?'gerekli sistem ve erişim kapsamını':'onaylanacak bilgi veya değişikliği'} netleştirin.`,nextStep:access?'Gereken sisteme yetkili erişimi sağlayın ve bağlantıyı kontrol edin.':'İlgili bilgi veya değişiklik için müşteri onayını kaydedin.',owner:access?'Müşteri / sistem yetkilisi':'Müşteri karar yetkilisi'};
}
export function sortWorkBlockers(items){
 return [...items].sort((a,b)=>{
  const blocked=Number(isBlockedWork(b))-Number(isBlockedWork(a));
  if(blocked)return blocked;
  const time=x=>new Date(x.updatedAt||x.createdAt).getTime()||0;
  return isBlockedWork(a)?time(a)-time(b):time(b)-time(a);
 });
}
