// Review-only, pure evidence normalization. No provider calls, storage or billing.
const safeText = (value, limit = 4000) => typeof value === 'string' && value.trim().length <= limit ? value.trim() : '';
const isoDate = value => {
  if (typeof value !== 'string') return null;
  // Require a complete timestamp with an explicit timezone; reject calendar rollover.
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return null;
  const [,year,month,day,hour,minute,second,zone] = match;
  const y=Number(year), m=Number(month), d=Number(day);
  const leap=y%4===0 && (y%100!==0 || y%400===0);
  const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
  if (m<1 || m>12 || d<1 || d>days[m-1] || Number(hour)>23 || Number(minute)>59 || Number(second)>59) return null;
  if (zone!=='Z' && (Number(zone.slice(1,3))>23 || Number(zone.slice(4))>59)) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
};
const safeHttpUrl = value => {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return url.toString();
  } catch { return null; }
};

// Invalid, incomplete or demo observations never become verified evidence.
export function normalizeAnswerEvidence(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {status:'unverified',reason:'invalid-record'};
  if (raw.demo === true || raw.synthetic === true) return {status:'unverified',reason:'demo-record'};
  const provider=safeText(raw.provider,100),model=safeText(raw.model,150);
  const query=safeText(raw.query,1000),answer=safeText(raw.answer ?? raw.text,12000);
  const observedAt=isoDate(raw.observedAt ?? raw.createdAt);
  if (!provider || !model || !query || !answer || !observedAt) return {status:'unverified',reason:'missing-provenance'};
  if (raw.truncated === true || raw.providerFailed === true) return {status:'unverified',reason:'incomplete-response'};
  if (Array.isArray(raw.citations) && raw.citations.length>100) return {status:'unverified',reason:'incomplete-response'};
  const citations=Array.isArray(raw.citations)?raw.citations.map(item=>{
    const url=safeHttpUrl(typeof item==='string'?item:item?.url);
    return url?{url}:null;
  }).filter(Boolean):[];
  return {status:'recorded',provider,model,query,answer,observedAt,citations,
    citationStatus:citations.length?'links-recorded-not-verified':'no-citations'};
}
