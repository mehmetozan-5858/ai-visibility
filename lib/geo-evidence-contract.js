// Review-only, pure evidence normalization. No provider calls, storage or billing.
const safeText = (value, limit = 4000) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
const isoDate = value => {
  if (typeof value !== 'string' || !value.trim()) return null;
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
  const citations=Array.isArray(raw.citations)?raw.citations.slice(0,100).map(item=>{
    const url=safeHttpUrl(typeof item==='string'?item:item?.url);
    return url?{url}:null;
  }).filter(Boolean):[];
  return {status:'recorded',provider,model,query,answer,observedAt,citations,
    citationStatus:citations.length?'links-recorded-not-verified':'no-citations'};
}
