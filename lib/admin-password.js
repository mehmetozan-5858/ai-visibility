import crypto from "node:crypto";
import {getDatabaseUrl} from "./db";

async function withDb(fn){
  const url=getDatabaseUrl();if(!url)throw new Error("database-not-configured");
  const {Pool}=await import("pg");
  const pool=new Pool({connectionString:url,ssl:{rejectUnauthorized:false}});
  try{
    await pool.query(`CREATE TABLE IF NOT EXISTS admin_credentials(
      id INTEGER PRIMARY KEY CHECK(id=1),
      password_hash TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS password_reset_codes(
      id UUID PRIMARY KEY,
      channel TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    return await fn(pool);
  }finally{await pool.end();}
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
function resetCodeHash(code){
  const secret=process.env.AUTH_SECRET||"";
  return crypto.createHmac("sha256",secret).update(String(code)).digest("hex");
}
function safeEqualHex(a,b){
  const aa=Buffer.from(String(a||""),"hex"),bb=Buffer.from(String(b||""),"hex");
  return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb);
}
export async function verifyAdminPassword(input=""){
  const dbHash=await withDb(async pool=>(await pool.query("SELECT password_hash FROM admin_credentials WHERE id=1")).rows[0]?.password_hash||"");
  if(dbHash)return verifyHash(input,dbHash);
  const env=String(process.env.ADMIN_PASSWORD||"");
  const val=String(input||"");
  if(!env||env.length!==val.length)return false;
  return crypto.timingSafeEqual(Buffer.from(env),Buffer.from(val));
}
export async function setAdminPassword(password){
  if(String(password).length<10)throw new Error("password-too-short");
  const hash=hashPassword(password);
  await withDb(async pool=>pool.query(
    "INSERT INTO admin_credentials(id,password_hash,updated_at) VALUES(1,$1,NOW()) ON CONFLICT(id) DO UPDATE SET password_hash=EXCLUDED.password_hash,updated_at=NOW()",
    [hash]
  ));
  return true;
}
export async function createResetRequest(channel,code){
  const id=crypto.randomUUID();
  const expiresAt=new Date(Date.now()+10*60*1000);
  await withDb(async pool=>{
    await pool.query("DELETE FROM password_reset_codes WHERE expires_at<NOW() OR used_at IS NOT NULL");
    await pool.query(
      "INSERT INTO password_reset_codes(id,channel,code_hash,expires_at) VALUES($1,$2,$3,$4)",
      [id,channel,resetCodeHash(code),expiresAt]
    );
  });
  return {id,expiresAt:expiresAt.toISOString()};
}
export async function verifyResetCode(id,code){
  return await withDb(async pool=>{
    const row=(await pool.query("SELECT * FROM password_reset_codes WHERE id=$1",[id])).rows[0];
    if(!row)return {ok:false,reason:"not-found"};
    if(row.used_at)return {ok:false,reason:"used"};
    if(new Date(row.expires_at).getTime()<Date.now())return {ok:false,reason:"expired"};
    if(Number(row.attempts)>=5)return {ok:false,reason:"locked"};
    const ok=safeEqualHex(row.code_hash,resetCodeHash(code));
    if(!ok){
      await pool.query("UPDATE password_reset_codes SET attempts=attempts+1 WHERE id=$1",[id]);
      return {ok:false,reason:"invalid"};
    }
    return {ok:true,channel:row.channel};
  });
}
export async function finishReset(id,newPassword){
  await setAdminPassword(newPassword);
  await withDb(async pool=>pool.query("UPDATE password_reset_codes SET used_at=NOW() WHERE id=$1",[id]));
}
