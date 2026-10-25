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
  // ZERA pilot preview must never fall back to the shared production database.
  if(process.env.VERCEL_ENV==="preview" && process.env.VERCEL_GIT_COMMIT_REF==="feat/zera-pilot-full-package"){
    return normalizeDatabaseUrl(process.env.ZERA_PREVIEW_DATABASE_URL||"");
  }
  return normalizeDatabaseUrl(process.env.DATABASE_URL||process.env.STORAGE_URL||"");
}

export function databaseStatus(){
  const url=getDatabaseUrl();
  return {configured:Boolean(url),mode:url?"production-ready":"demo"};
}
