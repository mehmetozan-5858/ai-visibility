export const commerceFields=[['catalogStatus','catalogEvidence'],['pricingStatus','pricingEvidence'],['availabilityStatus','availabilityEvidence'],['purchasePathStatus','purchasePathEvidence']];
export function metricNumber(value){
 if(value===null||value===undefined||!['number','string'].includes(typeof value)||String(value).trim()==='')return null;
 const n=Number(value);return Number.isFinite(n)&&n>=0?n:null;
}
export function businessMetricSummary(metrics={}){
 const values=['monthlyTraffic','monthlyConversions','averageValue','monthlyRevenue'].map(k=>metricNumber(metrics[k]));
 const [traffic,conversions,average,revenue]=values;
 const sourced=typeof metrics.evidence==='string'&&metrics.evidence.trim().length>0;
 const currencyValid=['TRY','USD','EUR','GBP'].includes(metrics.currency);
 return {coverage:values.filter(v=>v!==null).length,sourced,
 conversionRate:sourced&&traffic!==null&&traffic>0&&conversions!==null&&conversions<=traffic?conversions/traffic*100:null,
 recordedRevenue:sourced&&currencyValid?revenue:null,
 derivedRevenue:sourced&&currencyValid&&conversions!==null&&average!==null&&Number.isFinite(conversions*average)?conversions*average:null};
}
export function commerceSignalSummary(signals={}){
 const scores=commerceFields.map(([status,evidence])=>{
  if(typeof signals[evidence]!=='string'||!signals[evidence].trim())return null;
  return signals[status]==='verified'?100:signals[status]==='partial'?50:null;
 });
 const covered=scores.filter(x=>x!==null).length;
 return {covered,declared: scores.filter(x=>x===100).length,score:covered===4?Math.round(scores.reduce((a,b)=>a+b,0)/4):null};
}
export async function readCommerceClient(fetcher,id,signal){
 const read=async(path,key)=>{
  const r=await fetcher(path+'?clientId='+encodeURIComponent(id),{cache:'no-store',signal});
  if(!r.ok)throw Error('İşletmenin ticari verileri okunamadı. Oturumu ve bağlantıyı kontrol edin.');
  const d=await r.json();if(d[key]?.clientId!==id)throw Error('Ticari veri müşteriyle eşleşmiyor.');return d[key];
 };
 const [signals,metrics]=await Promise.all([read('/api/commerce-signals','signals'),read('/api/business-impact','metrics')]);
 return {signals,metrics};
}
