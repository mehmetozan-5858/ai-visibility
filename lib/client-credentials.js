import {hashPassword,verifyHash} from "./client-password-verifier.mjs";
export {hashPassword,verifyHash} from "./client-password-verifier.mjs";
import {getDatabaseUrl} from "./db";

function normalizeDatabaseUrl(rawUrl){
  if(!rawUrl)return "";
  try{
    const url=new URL(rawUrl);
    const sslmode=url.searchParams.get("sslmode");
    if(["prefer","require","verify-ca"].includes(sslmode))url.searchParams.set("sslmode","verify-full");
    return url.toString();
  }catch{return rawUrl}
}
// Schema is provisioned by reviewed migrations, not by customer requests.
async function withDb(fn){
  const url=normalizeDatabaseUrl(getDatabaseUrl());
  if(!url)throw new Error("database-not-configured");
  const {Pool}=await import("pg");
  const pool=new Pool({connectionString:url});
  try{return await fn(pool)}finally{await pool.end()}
}
export async function createClientCredential(clientId,email,password){
  const cleanEmail=String(email||"").trim().toLowerCase();
  if(!cleanEmail.includes("@"))throw new Error("invalid-email");
  if(String(password||"").length<10)throw new Error("password-too-short");
  const hash=hashPassword(password);
  return await withDb(async pool=>{const row=(await pool.query(
    `INSERT INTO client_credentials(client_id,email,password_hash)
     VALUES($1,$2,$3)
     ON CONFLICT(client_id) DO NOTHING
     RETURNING client_id AS "clientId",email`,
    [clientId,cleanEmail,hash]
  )).rows[0];if(!row)throw new Error("credential-already-exists");return row;});
}
export async function resetClientPassword(clientId,email,password){
  if(String(password||"").length<10)throw new Error("password-too-short");
  const hash=hashPassword(password);
  return withDb(async pool=>{const row=(await pool.query(
    'UPDATE client_credentials SET password_hash=$3,updated_at=NOW() WHERE client_id=$1 AND lower(email)=lower($2) RETURNING client_id AS "clientId",email',
    [clientId,String(email||"").trim().toLowerCase(),hash]
  )).rows[0];if(!row)throw new Error("credential-not-found");return row;});
}
export async function verifyClientCredential(email,password){
  const cleanEmail=String(email||"").trim().toLowerCase();
  return await withDb(async pool=>{
    const row=(await pool.query(
      'SELECT client_id AS "clientId",email,password_hash AS "passwordHash" FROM client_credentials WHERE lower(email)=lower($1) LIMIT 1',
      [cleanEmail]
    )).rows[0];
    if(!row||!verifyHash(password,row.passwordHash))return null;
    return {clientId:row.clientId,email:row.email};
  });
}
export async function getClientCredential(clientId){
  return await withDb(async pool=>(await pool.query(
    'SELECT client_id AS "clientId",email FROM client_credentials WHERE client_id=$1',
    [clientId]
  )).rows[0]||null);
}
export async function getClientCredentialByEmail(email){
  const cleanEmail=String(email||"").trim().toLowerCase();
  if(!cleanEmail.includes("@"))return null;
  return await withDb(async pool=>(await pool.query(
    'SELECT client_id AS "clientId",email FROM client_credentials WHERE lower(email)=lower($1) LIMIT 1',
    [cleanEmail]
  )).rows[0]||null);
}

// Server-only connection wrapper for the atomic synthetic admin test.
export async function withClientCredentialDatabase(fn){return withDb(fn)}
