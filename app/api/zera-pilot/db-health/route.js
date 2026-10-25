import {getDatabaseUrl} from '../../../../lib/db';
import {databasePool} from '../../../../lib/database-runtime';
export const dynamic='force-dynamic';
export async function GET(){
 const headers={'Cache-Control':'no-store'};
 if(process.env.VERCEL_ENV!=='preview'||process.env.VERCEL_GIT_COMMIT_REF!=='feat/zera-pilot-full-package')return Response.json({ready:false,reason:'unavailable'},{status:404,headers});
 const url=getDatabaseUrl();
 if(!url||!process.env.ZERA_PREVIEW_DATABASE_URL)return Response.json({ready:false,reason:'test-database-not-configured'},{status:503,headers});
 try{
  const result=await databasePool(url).query('SELECT 1 AS connected');
  return Response.json({ready:result.rows[0]?.connected===1,database:'isolated-preview',customerDataQueried:false},{headers});
 }catch{
  return Response.json({ready:false,reason:'connection-failed'},{status:503,headers});
 }
}
