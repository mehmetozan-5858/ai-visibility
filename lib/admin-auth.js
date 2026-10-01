const enc=new TextEncoder();

function b64url(bytes){
  let s="";
  for(const b of new Uint8Array(bytes))s+=String.fromCharCode(b);
  return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}

async function hmac(value,secret){
  const key=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return b64url(await crypto.subtle.sign("HMAC",key,enc.encode(value)));
}

export function authConfigured(){
  return Boolean(process.env.ADMIN_PASSWORD&&process.env.AUTH_SECRET);
}

export async function createAdminToken(){
  if(!authConfigured())throw new Error("auth-not-configured");
  const exp=Math.floor(Date.now()/1000)+(12*60*60);
  const sig=await hmac(String(exp),process.env.AUTH_SECRET);
  return exp+"."+sig;
}

export async function verifyAdminToken(token=""){
  if(!authConfigured())return true;
  const [expRaw,sig]=String(token).split(".");
  const exp=Number(expRaw);
  if(!exp||!sig||exp<Math.floor(Date.now()/1000))return false;
  const expected=await hmac(String(exp),process.env.AUTH_SECRET);
  if(expected.length!==sig.length)return false;
  let diff=0;
  for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^sig.charCodeAt(i);
  return diff===0;
}

export function passwordMatches(input=""){
  const a=String(input),b=String(process.env.ADMIN_PASSWORD||"");
  if(!b||a.length!==b.length)return false;
  let diff=0;
  for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
  return diff===0;
}
