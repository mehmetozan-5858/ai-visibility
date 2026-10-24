/**
 * Consistent non-cacheable responses for the admin-only pilot registration.
 * Never expose database, provider, or internal exception details to clients.
 */
const headers=Object.freeze({
  "Cache-Control":"private, no-store, max-age=0",
  "Pragma":"no-cache",
  "Vary":"Cookie"
});
export function zeraRegistrationResponse(body,status=200){
  return Response.json(body,{status,headers});
}
export function zeraRegistrationFailure(){
  return zeraRegistrationResponse({error:"Pilot registration could not be completed"},503);
}
