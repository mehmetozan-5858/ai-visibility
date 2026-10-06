import {AsyncLocalStorage} from 'node:async_hooks';
const budgets=new AsyncLocalStorage();
export function withRequestBudget(milliseconds,fn){return budgets.run({deadline:Date.now()+milliseconds},fn)}
export function remainingBudget(){return Math.max(0,(budgets.getStore()?.deadline||Infinity)-Date.now())}
export async function budgetFetch(url,options={}){
 const configured=Number(process.env.PROVIDER_REQUEST_TIMEOUT_MS)||15000;
 const timeout=Math.floor(Math.min(Math.max(1000,Math.min(configured,30000)),remainingBudget()));
 if(timeout<=0)throw new Error('request-budget-exhausted');
 const signal=AbortSignal.timeout(timeout);
 return globalThis.fetch(url,{...options,signal:options.signal?AbortSignal.any([signal,options.signal]):signal});
}
