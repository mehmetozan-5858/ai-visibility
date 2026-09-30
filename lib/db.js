// Production database boundary.
// When DATABASE_URL is configured, replace the demo repository adapter with
// a server-side database client. Secrets must stay in the host environment.
export function databaseStatus(){return {configured:Boolean(process.env.DATABASE_URL),mode:process.env.DATABASE_URL?"production-ready":"demo"}}
