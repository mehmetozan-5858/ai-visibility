/**
 * Separate applicant challenge transport. Never log provider response bodies,
 * tokens, addresses or challenge codes. Keep disabled behind the caller's gate.
 */
export async function sendLeadVerificationEmail(email,code){
 if(typeof email!=="string"||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!/^\d{6}$/.test(code))throw Error("invalid-email");
 const apiKey=process.env.RESEND_API_KEY;
 const from=process.env.EMAIL_FROM||process.env.RESEND_FROM_EMAIL;
 if(!apiKey||!from)throw Error("email-provider-not-configured");
 let response;
 try{
  response=await fetch("https://api.resend.com/emails",{
   method:"POST",
   headers:{"authorization":"Bearer "+apiKey,"content-type":"application/json"},
   body:JSON.stringify({
    from,to:[email],subject:"AI Visibility Works — E-posta doğrulama / Email verification",
    text:"AI Visibility Works doğrulama kodunuz / Your verification code: "+code+
     "\nKod 10 dakika geçerlidir / Valid for 10 minutes.\nİşlemi siz başlatmadıysanız dikkate almayın / Ignore if you did not request this."
   })
  });
 }catch{throw Error("lead-email-delivery-failed")}
 if(!response.ok)throw Error("lead-email-delivery-failed");
 return true;
}
