import {createClientToken} from './admin-auth.js';

/**
 * REVIEW ONLY — not imported by a live login route.
 * The callback is a trusted server-side credential verifier and MUST
 * verify the existing password hash; this adapter does not set/reset any
 * credential. Fail closed if verification is missing or returns bad identity.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function issueExistingPasswordSessionReview({email,password,verifyExisting}={}){
 if(typeof verifyExisting!=='function'||typeof email!=='string'||
    !email.trim().includes('@')||typeof password!=='string'||!password)
  throw Error('review-login-invalid-request');
 const identity=await verifyExisting(email.trim().toLowerCase(),password);
 if(!identity)return null;
 if(!UUID.test(String(identity.clientId))||
    String(identity.email||'').trim().toLowerCase()!==email.trim().toLowerCase())
  throw Error('review-login-untrusted-identity');
 return createClientToken(identity.clientId.toLowerCase());
}
