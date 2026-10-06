import crypto from "node:crypto";
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
async function withDb(fn){
  const url=normalizeDatabaseUrl(getDatabaseUrl());
  if(!url)throw new Error("database-not-configured");
  const {Pool}=await import("pg");
  const pool=new Pool({connectionString:url});
  try{
    await pool.query(`CREATE TABLE IF NOT EXISTS client_credentials(
      client_id UUID PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    return await fn(pool);
  }finally{await pool.end()}
}
function hashPassword(password){
  const salt=crypto.randomBytes(16);
  const hash=crypto.scryptSync(String(password),salt,64);
  return "scrypt$"+salt.toString("hex")+"$"+hash.toString("hex");
}
function verifyHash(password,stored=""){
  const [kind,saltHex,hashHex]=String(stored).split("$");
  if(kind!=="scrypt"||!saltHex||!hashHex)return false;
  const actual=crypto.scryptSync(String(password),Buffer.from(saltHex,"hex"),64);
  const expected=Buffer.from(hashHex,"hex");
  return actual.length===expected.length&&crypto.timingSafeEqual(actual,expected);
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
