const fields=['runs','neutralComplete','brandMentions','officialCitations','failed'];
export function readDashboardEvidence(value){
 if(value?.available!==true||!/^\d{4}-\d{2}-\d{2}$/.test(value.date||'')||!Number.isFinite(Date.parse(value.generatedAt))||typeof value.limited!=='boolean'||!Number.isInteger(value.totalRuns)||value.totalRuns<0||!fields.every(k=>Number.isInteger(value.counts?.[k])&&value.counts[k]>=0))throw Error('dashboard-evidence-unavailable');
 if(value.counts.brandMentions>value.counts.neutralComplete||value.counts.officialCitations>value.counts.neutralComplete||value.counts.runs>value.totalRuns)throw Error('dashboard-evidence-unavailable');
 return value;
}
