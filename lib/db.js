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
  // Never inherit the Production database URL on a Vercel Preview deployment.
  // An independently configured, branch-scoped test database is required.
  if(process.env.VERCEL_ENV==="preview")
    return normalizeDatabaseUrl(process.env.ZERA_PREVIEW_DATABASE_URL||"");
  return normalizeDatabaseUrl(process.env.DATABASE_URL||process.env.STORAGE_URL||"");
}

export function databaseStatus(){
  const url=getDatabaseUrl();
  return {configured:Boolean(url),mode:url?"production-ready":"demo"};
}
