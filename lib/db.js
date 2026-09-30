// Production database boundary. Supports Vercel/Neon custom env prefixes.
export function getDatabaseUrl(){return process.env.DATABASE_URL||process.env.STORAGE_URL||""}
export function databaseStatus(){const url=getDatabaseUrl();return {configured:Boolean(url),mode:url?"production-ready":"demo"}}
