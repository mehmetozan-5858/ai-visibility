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
    await pool.query(`CREATE TABLE IF NOT EXISTS client_email_verifications(
      id UUID PRIMARY KEY,
      client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      verified_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query('CREATE INDEX IF NOT EXISTS client_email_verifications_lookup_idx ON client_email_verifications(client_id,email,created_at DESC)');
    return await fn(pool);
  }finally{await pool.end()}
}
function normalizeEmail(email){return String(email||"").trim().toLowerCase()}
function hashCode(code){return crypto.createHash("sha256").update(String(code)).digest("hex")}
export async function createVerificationCode(clientId,email){
  const clean=normalizeEmail(email);
  if(!clean.includes("@"))throw new Error("invalid-email");
  const code=String(crypto.randomInt(100000,1000000));
  const id=crypto.randomUUID();
  await withDb(async pool=>{
    const recent=(await pool.query(`SELECT 1 FROM client_email_verifications WHERE client_id=$1 AND lower(email)=lower($2) AND created_at>NOW()-INTERVAL '60 seconds' LIMIT 1`,[clientId,clean])).rows[0];
    if(recent)throw new Error("verification-rate-limit");
    await pool.query('DELETE FROM client_email_verifications WHERE client_id=$1 AND lower(email)=lower($2) AND verified_at IS NULL',[clientId,clean]);
    await pool.query('INSERT INTO client_email_verifications(id,client_id,email,code_hash,expires_at) VALUES($1,$2,$3,$4,NOW()+INTERVAL \'10 minutes\')',[id,clientId,clean,hashCode(code)]);
  });
  return {code,email:clean};
}
export async function verifyEmailCode(clientId,email,code){
  const clean=normalizeEmail(email);
  const hash=hashCode(code);
  return await withDb(async pool=>{
    const row=(await pool.query(`UPDATE client_email_verifications
      SET verified_at=NOW()
      WHERE id=(SELECT id FROM client_email_verifications
        WHERE client_id=$1 AND lower(email)=lower($2) AND code_hash=$3 AND verified_at IS NULL AND expires_at>NOW()
        ORDER BY created_at DESC LIMIT 1)
      RETURNING id,client_id AS "clientId",email,verified_at AS "verifiedAt"`,[clientId,clean,hash])).rows[0];
    return row||null;
  });
}
export async function isEmailVerified(clientId,email){
  const clean=normalizeEmail(email);
  return await withDb(async pool=>Boolean((await pool.query(`SELECT 1 FROM client_email_verifications
    WHERE client_id=$1 AND lower(email)=lower($2) AND verified_at IS NOT NULL AND verified_at>NOW()-INTERVAL '30 minutes'
    ORDER BY verified_at DESC LIMIT 1`,[clientId,clean])).rows[0]));
}
export async function sendVerificationEmail(email,code){
  const apiKey=process.env.RESEND_API_KEY||"";
  const from=process.env.EMAIL_FROM||process.env.RESEND_FROM_EMAIL||"";
  if(!apiKey||!from)throw new Error("email-provider-not-configured");
  const r=await fetch("https://api.resend.com/emails",{
    method:"POST",
    headers:{"authorization":"Bearer "+apiKey,"content-type":"application/json"},
    body:JSON.stringify({from,to:[email],subject:"AI Visibility doğrulama kodunuz",html:`<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h2>AI Visibility</h2><p>Müşteri hesabınızı doğrulamak için kodunuz:</p><div style="font-size:34px;font-weight:700;letter-spacing:8px;margin:24px 0">${code}</div><p>Bu kod 10 dakika geçerlidir. Bu işlemi siz başlatmadıysanız bu e-postayı yok sayabilirsiniz.</p></div>`})
  });
  if(!r.ok){const t=await r.text();throw new Error("email-send-failed:"+t.slice(0,160))}
  return true;
}
