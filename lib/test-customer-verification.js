import crypto from 'node:crypto';

// Only the authenticated admin's fixed synthetic account may use this workflow.
export async function completeTestCredential(pool,{client,email,code,password,hashPassword}){
 if(client?.name!=='AI Visibility Test Müşteri'||client?.domain!=='test.ai-visibility.local')throw Error('test-client-mismatch');
 if(!/^\d{6}$/.test(code||''))throw Error('invalid-verification-code');
 const tx=await pool.connect();
 try{
  await tx.query('BEGIN');
  const existing=(await tx.query('SELECT email FROM client_credentials WHERE client_id=$1 FOR UPDATE',[client.id])).rows[0];
  const loginEmail=String(existing?.email||email).trim().toLowerCase();
  if(!loginEmail.includes('@'))throw Error('test-credential-email-invalid');
  if(!existing){
   const owner=(await tx.query('SELECT client_id FROM client_credentials WHERE lower(email)=lower($1)',[loginEmail])).rows[0];
   if(owner&&owner.client_id!==client.id)throw Error('test-email-in-use');
  }
  const verified=(await tx.query(`UPDATE client_email_verifications SET verified_at=NOW()
   WHERE id=(SELECT id FROM client_email_verifications WHERE client_id=$1 AND lower(email)=lower($2) AND code_hash=$3 AND verified_at IS NULL AND expires_at>NOW() ORDER BY created_at DESC LIMIT 1) RETURNING id`,[client.id,email,crypto.createHash('sha256').update(code).digest('hex')])).rows[0];
  if(!verified)throw Error('verification-invalid-or-expired');
  const hash=hashPassword(password);
  const result=existing?await tx.query('UPDATE client_credentials SET password_hash=$2,updated_at=NOW() WHERE client_id=$1 RETURNING client_id',[client.id,hash]):await tx.query('INSERT INTO client_credentials(client_id,email,password_hash) VALUES($1,$2,$3) RETURNING client_id',[client.id,loginEmail,hash]);
  if(!result.rows.length)throw Error('test-credential-not-written');
  await tx.query('COMMIT');return {email:loginEmail};
 }catch(error){await tx.query('ROLLBACK');throw error}finally{tx.release()}
}
