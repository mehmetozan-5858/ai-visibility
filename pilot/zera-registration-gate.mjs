/**
 * Fail-closed write gate for the ZERA pilot registration endpoint.
 * Registration is intentionally forbidden in production, including when
 * preview-only flags have accidentally been copied to production.
 * The flag is an explicit operator switch, not a substitute for DB isolation.
 */
export function zeraRegistrationGate(env={}){
  if(env.VERCEL_ENV!=="preview")return {allowed:false,reason:"registration-preview-only"};
  if(env.ZERA_ISOLATED_PREVIEW_DB!=="verified")return {allowed:false,reason:"preview-db-isolation-unverified"};
  if(env.ZERA_PILOT_REGISTRATION_ENABLED!=="true")return {allowed:false,reason:"registration-not-enabled"};
  return {allowed:true,reason:"isolated-preview-registration-enabled"};
}
