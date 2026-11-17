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
  if(process.env.VERCEL_ENV==="preview"){
    const preview=process.env.ZERA_PREVIEW_DATABASE_URL||"";
    if(!preview)return "";
    // A different secret or database role does not mean a different database.
    // Fail closed if the preview connection points at any configured production
    // database host/port/database identity.
    const identity=raw=>{
      try{
        const u=new URL(raw);
        if(!["postgres:","postgresql:"].includes(u.protocol))return "";
        // Neon direct and pooled endpoints differ by "-pooler" only.
        // Both can reach the same underlying branch and database.
        const host=u.hostname.toLowerCase().replace(/-pooler(?=\.)/g,"");
        return host+":"+(u.port||"5432")+decodeURIComponent(u.pathname);
      }catch{return ""}
    };
    const previewId=identity(preview);
    if(!previewId)return "";
    for(const raw of [process.env.DATABASE_URL,process.env.DATABASE_URL_UNPOOLED,process.env.STORAGE_URL,process.env.POSTGRES_URL,process.env.POSTGRES_URL_NON_POOLING]){
      if(raw&&identity(raw)===previewId)return "";
    }
    return normalizeDatabaseUrl(preview);
  }
  return normalizeDatabaseUrl(process.env.DATABASE_URL||process.env.STORAGE_URL||"");
}

export function databaseStatus(){
  const url=getDatabaseUrl();
  return {configured:Boolean(url),mode:url?"production-ready":"demo"};
}
