import crypto from 'node:crypto';

// Consume the code and change the same account's password in one transaction.
export async function completeCustomerPasswordReset(pool,{clientId,email,code,password,hashPassword}){
 const normalized=String(email||'').trim().toLowerCase();
 if(!/^\d{6}$/.test(String(code||'')))throw Error('verification-invalid-or-expired');
 if(String(password||'').length<10)throw Error('password-too-short');
 const hash=hashPassword(password);
 const tx=await pool.connect();
 try{
  await tx.query('BEGIN');
  const credential=(await tx.query('SELECT client_id FROM client_credentials WHERE client_id=$1 AND lower(email)=lower($2) FOR UPDATE',[clientId,normalized])).rows[0];
  if(!credential)throw Error('verification-invalid-or-expired');
  const verified=(await tx.query(`UPDATE client_email_verifications SET verified_at=NOW()
    WHERE id=(SELECT id FROM client_email_verifications
      WHERE client_id=$1 AND lower(email)=lower($2) AND code_hash=$3 AND verified_at IS NULL AND expires_at>NOW()
      ORDER BY created_at DESC LIMIT 1) AND verified_at IS NULL RETURNING id`,
    [clientId,normalized,crypto.createHash('sha256').update(String(code)).digest('hex')])).rows[0];
  if(!verified)throw Error('verification-invalid-or-expired');
  const updated=(await tx.query('UPDATE client_credentials SET password_hash=$3,updated_at=NOW() WHERE client_id=$1 AND lower(email)=lower($2) RETURNING client_id',[clientId,normalized,hash])).rows[0];
  if(!updated)throw Error('credential-not-written');
  await tx.query('COMMIT');return true;
 }catch(error){await tx.query('ROLLBACK').catch(()=>{});throw error}finally{tx.release()}
}
