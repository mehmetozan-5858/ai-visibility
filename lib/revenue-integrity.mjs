/** Deterministic reconciliation of authorized ledgers. No billing or collection.
 * Callers must authorize tenant access and load source records on the server.
 * Amounts are signed integer minor-unit strings; currencies are never converted.
 */
const id=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(v);
function normalize(row,tenantId){
 if(!row||row.tenantId!==tenantId||![row.id,row.subscriptionId,row.sourceId].every(id))throw Error('invalid-record-scope');
 if(typeof row.currency!=='string'||!/^[A-Z]{3}$/.test(row.currency)||
    typeof row.period!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(row.period))throw Error('invalid-accounting-scope');
 if(typeof row.amountMinor!=='string'||!/^(-?[1-9][0-9]{0,17}|0)$/.test(row.amountMinor))throw Error('invalid-minor-amount');
 return {id:row.id,subscriptionId:row.subscriptionId,sourceId:row.sourceId,currency:row.currency,period:row.period,amountMinor:row.amountMinor};
}
export function reconcileRevenue({tenantId,expected,invoiced}={}){
 if(!id(tenantId)||![expected,invoiced].every(v=>Array.isArray(v)&&v.length<=10000))throw Error('invalid-reconciliation');
 const groups=new Map();let duplicates=0;
 for(const [kind,rows] of [['expected',expected],['invoiced',invoiced]]){
  const seen=new Map();
  for(const raw of rows){
   const row=normalize(raw,tenantId),serialized=JSON.stringify(row);
   if(seen.has(row.id)){
    if(seen.get(row.id)!==serialized)throw Error('conflicting-record-id');
    duplicates++;continue;
   }
   seen.set(row.id,serialized);
   const key=JSON.stringify([row.subscriptionId,row.period,row.currency]);
   if(!groups.has(key))groups.set(key,{subscriptionId:row.subscriptionId,period:row.period,currency:row.currency,
    expected:0n,invoiced:0n,expectedSources:new Set(),invoicedSources:new Set(),expectedRecords:0,invoicedRecords:0});
   const group=groups.get(key);group[kind]+=BigInt(row.amountMinor);group[kind+'Sources'].add(row.sourceId);group[kind+'Records']++;
  }
 }
 const comparisons=[...groups.values()].map(g=>{
  const difference=g.expected-g.invoiced;
  // A missing counterpart is incomplete evidence, even if its net amount is zero.
  const status=!g.expectedRecords?'unexpected-invoice':!g.invoicedRecords?'missing-invoice':difference===0n?'matched':difference>0n?'potential-underbilling':'potential-overbilling';
  return {subscriptionId:g.subscriptionId,period:g.period,currency:g.currency,status,
   expectedMinor:String(g.expected),invoicedMinor:String(g.invoiced),differenceMinor:String(difference),
   evidence:{expected:[...g.expectedSources].sort(),invoiced:[...g.invoicedSources].sort()}};
 }).sort((a,b)=>JSON.stringify([a.subscriptionId,a.period,a.currency]).localeCompare(JSON.stringify([b.subscriptionId,b.period,b.currency])));
 return {tenantId,state:'review-required',collectionPerformed:false,duplicatesIgnored:duplicates,comparisons,
  disclaimer:'Ledger differences are review candidates, not collected revenue or proven loss.'};
}
