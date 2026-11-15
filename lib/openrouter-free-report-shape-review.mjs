// REVIEW ONLY — validate provider output shape before it can become a
// customer-visible analysis. This does NOT verify external factual claims.
const metrics=['citationReadiness','entityClarity','answerReadiness','localContext','confidence'];
const validScore=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=100;
const text=x=>typeof x==='string'&&x.trim().length>0&&x.length<=5000;
const stringList=x=>Array.isArray(x)&&x.length>=1&&x.length<=8&&x.every(text);
export function assertOpenRouterFreeReportShape(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||
    !validScore(value.score)||!text(value.summary)||!text(value.reason)||
    !stringList(value.findings)||!stringList(value.recommendations)||
    !value.visibility||typeof value.visibility!=='object'||Array.isArray(value.visibility)||
    !['yes','no','unknown'].includes(value.visibility.brandMention)||
    !metrics.every(k=>validScore(value.visibility[k])))
  throw Error('openrouter-free-report-schema-unverified');
 // Discard extra/untrusted model-authored fields such as provider and receipts.
 return {score:value.score,summary:value.summary,reason:value.reason,
  findings:[...value.findings],recommendations:[...value.recommendations],
  visibility:{brandMention:value.visibility.brandMention,
   ...Object.fromEntries(metrics.map(k=>[k,value.visibility[k]]))}};
}
