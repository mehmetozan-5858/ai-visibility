import crypto from "node:crypto";

const ALPHABET="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function decodeBase32(value=""){
  const normalized=String(value).toUpperCase().replace(/\s|-/g,"").replace(/=+$/,"");
  if(!normalized||!/^[A-Z2-7]+$/.test(normalized))throw new Error("invalid-totp-secret");
  let bits=0,buffer=0;const out=[];
  for(const char of normalized){buffer=(buffer<<5)|ALPHABET.indexOf(char);bits+=5;
    if(bits>=8){bits-=8;out.push((buffer>>bits)&255);buffer&=(1<<bits)-1;}}
  if(out.length<20)throw new Error("totp-secret-too-short");
  return Buffer.from(out);
}
export function generateTotpSecret(){
  const bytes=crypto.randomBytes(20);let buffer=0,bits=0,result="";
  for(const byte of bytes){buffer=(buffer<<8)|byte;bits+=8;
    while(bits>=5){bits-=5;result+=ALPHABET[(buffer>>bits)&31];buffer&=(1<<bits)-1;}}
  if(bits)result+=ALPHABET[(buffer<<(5-bits))&31];
  return result;
}
export function totpAt(secret,time=Date.now()){
  const key=decodeBase32(secret),counter=Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(time/30000)));
  const digest=crypto.createHmac("sha1",key).update(counter).digest();
  const offset=digest[digest.length-1]&15;
  const value=(digest.readUInt32BE(offset)&0x7fffffff)%1000000;
  return String(value).padStart(6,"0");
}
export function verifyTotp(secret,code,time=Date.now()){
  if(!/^\d{6}$/.test(String(code)))return false;
  try{
    for(const delta of [-30000,0,30000]){
      const expected=Buffer.from(totpAt(secret,time+delta));
      if(crypto.timingSafeEqual(expected,Buffer.from(String(code))))return true;
    }
  }catch{return false}
  return false;
}
export function totpUri(secret,account="admin@aivisibilityworks.com"){
  decodeBase32(secret);
  return "otpauth://totp/"+encodeURIComponent("AI Visibility:"+account)+"?secret="+encodeURIComponent(secret)+"&issuer="+encodeURIComponent("AI Visibility")+"&algorithm=SHA1&digits=6&period=30";
}
