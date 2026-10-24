/**
 * Validate that a ZERA registration is visible in the persistent repository
 * before acknowledging success. Pure function: no reads, writes or network.
 */
export function zeraRegistrationReadbackMatches(registration,client){
 return Boolean(
  registration && typeof registration.clientId==="string" &&
  registration.clientId.length>0 &&
  client && typeof client.id==="string" &&
  client.id===registration.clientId
 );
}
