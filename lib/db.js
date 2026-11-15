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
    // A distinct env var must never silently reuse the primary writer identity.
    // SQL privilege inspection remains a separate mandatory acceptance gate.
    const primary=getDatabaseUrl();
    if(primary){
      const writer=new URL(primary);
      if(parsed.href===writer.href||parsed.username===writer.username)
        throw Error('portal-reader-database-not-isolated');
    }
  }catch(error){
    if(error?.message==='portal-reader-database-not-isolated')throw error;
    throw Error('portal-reader-database-invalid');
  }
  return url;
}
