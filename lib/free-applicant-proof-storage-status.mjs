/** Read-only readiness probe for the separately reviewed applicant proof schema.
 * Never applies migrations, reads secrets, accesses provider APIs, or inspects
 * individual customer answers. Used only behind existing admin authorization.
 * A table existing is NOT provider receipt verification or release approval.
 */
export async function freeApplicantProofStorageStatus(pool){
 const unavailable=Object.freeze({status:'unavailable',ready:false,
   reason:'proof-storage-check-unavailable',customerAcceptance:false});
 if(!pool || typeof pool.query!=='function')return unavailable;
 try{
  const result=await pool.query(`SELECT
   to_regclass('public.free_applicant_verified_receipts') IS NOT NULL AS receipts,
   to_regclass('public.free_applicant_verified_observations') IS NOT NULL AS observations`);
  const row=result?.rows?.[0];
  if(typeof row?.receipts!=='boolean'||typeof row?.observations!=='boolean')
   return unavailable;
  return Object.freeze({
   status:row.receipts&&row.observations?'schema-present-unverified':'schema-incomplete',
   ready:false,
   receiptsTablePresent:row.receipts,
   observationsTablePresent:row.observations,
   reason:row.receipts&&row.observations?'constraints-and-provenance-still-unverified':'reviewed-proof-migration-not-complete',
   customerAcceptance:false
  });
 }catch{return unavailable;}
}
