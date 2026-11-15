import crypto from 'node:crypto';

// Isolated pure credential verifier: no DB access, no account mutation.
export function hashPassword(password){
 const salt=crypto.randomBytes(16);
 const hash=crypto.scryptSync(String(password),salt,64);
 return 'scrypt$'+salt.toString('hex')+'$'+hash.toString('hex');
}
export function verifyHash(password,stored=''){
 // Fail closed on an unsupported or damaged scrypt verifier. Never infer
 // credentials from a paid flag or reset/replace a stored customer password.
 const fields=typeof stored==='string'?stored.split('$'):[];
 if(fields.length!==3||fields[0]!=='scrypt'||
    !/^[0-9a-f]{32}$/i.test(fields[1])||
    !/^[0-9a-f]{128}$/i.test(fields[2]))return false;
 try{
  const actual=crypto.scryptSync(String(password),Buffer.from(fields[1],'hex'),64);
  const expected=Buffer.from(fields[2],'hex');
  return crypto.timingSafeEqual(actual,expected);
 }catch{return false}
}
