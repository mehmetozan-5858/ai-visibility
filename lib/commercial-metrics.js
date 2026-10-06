// Paid records are accounting inputs; test records never represent sales.
export function commercialMetrics(rows=[]){
 const real=rows.filter(x=>x.status==='paid'&&!/(^|\.)local$/i.test(String(x.domain||'').trim())&&!String(x.termsVersion||'').startsWith('test-flow-')&&['TRY','USD','EUR','GBP'].includes(x.currency)&&Number.isFinite(Number(x.setupAmount))&&Number.isFinite(Number(x.monthlyAmount))&&Number(x.setupAmount)>=0&&Number(x.monthlyAmount)>=0&&Number(x.setupAmount)+Number(x.monthlyAmount)>0);
 const revenue=new Map(),monthly=new Map(),latest=new Map();
 for(const row of real){
  const cents=Math.round(Number(row.setupAmount)*100)+Math.round(Number(row.monthlyAmount)*100);
  revenue.set(row.currency,(revenue.get(row.currency)||0)+cents);
  const previous=latest.get(row.clientId);
  const timestamp=Date.parse(row.paidAt)||0,previousTimestamp=Date.parse(previous?.paidAt)||0;
  if(!previous||timestamp>previousTimestamp||(timestamp===previousTimestamp&&String(row.id)>String(previous.id)))latest.set(row.clientId,row);
 }
 let activeClients=0;
 for(const row of latest.values())if(row.clientStatus==='active'){
  activeClients++;const cents=Math.round(Number(row.monthlyAmount)*100);
  if(cents>0)monthly.set(row.currency,(monthly.get(row.currency)||0)+cents);
 }
 const entries=map=>[...map].sort(([a],[b])=>a.localeCompare(b)).map(([currency,amount])=>({currency,amount:amount/100}));
 return {activeClients,paid:real.length,mrr:null,mrrByCurrency:entries(monthly),revenue:null,revenueByCurrency:entries(revenue)};
}
export async function readCommercialMetrics(pool){
 const rows=(await pool.query(`SELECT p.id,p.client_id AS "clientId",p.status,p.currency,p.setup_amount AS "setupAmount",p.monthly_amount AS "monthlyAmount",p.paid_at AS "paidAt",p.terms_version AS "termsVersion",c.domain,c.status AS "clientStatus" FROM payments p JOIN clients c ON c.id=p.client_id WHERE p.status='paid' ORDER BY p.paid_at,p.id`)).rows;
 return commercialMetrics(rows);
}
