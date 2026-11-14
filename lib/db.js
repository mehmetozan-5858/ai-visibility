// Production database boundary. Supports Vercel/Neon custom env prefixes.
function normalizeDatabaseUrl(rawUrl){
  if(!rawUrl)return "";
  try{
    const url=new URL(rawUrl);
    const sslmode=url.searchParams.get("sslmode");
    if(["prefer","require","verify-ca"].includes(sslmode))url.searchParams.set("sslmode","verify-full");
    return url.toString();
  }catch{return rawUrl}
}

export function getDatabaseUrl(){
  return normalizeDatabaseUrl(process.env.DATABASE_URL||process.env.STORAGE_URL||"");
}

export function databaseStatus(){
  const url=getDatabaseUrl();
  return {configured:Boolean(url),mode:url?"production-ready":"demo"};
}

// Opt-in only. Do not silently fall back to the write-capable database URL
// when a dedicated portal reader was explicitly requested.
export function portalReadDatabaseEnabled(){
  return process.env.PORTAL_READ_DB_ENABLED==='true';
}
export function getPortalReadDatabaseUrl(){
  if(!portalReadDatabaseEnabled())return getDatabaseUrl();
  const dedicated=process.env.PORTAL_READ_DATABASE_URL||'';
  if(!dedicated)throw Error('portal-reader-database-not-configured');
  const url=normalizeDatabaseUrl(dedicated);
  try{
    const parsed=new URL(url);
    if(!['postgres:','postgresql:'].includes(parsed.protocol)||!parsed.hostname||!parsed.username)
      throw Error('invalid');
  }catch{throw Error('portal-reader-database-invalid')}
  return url;
}
