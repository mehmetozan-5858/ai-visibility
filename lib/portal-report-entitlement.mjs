/**
 * Fail-closed entitlement preflight for the optional tenant-RLS report path.
 * An old database "paid" label is not a signed Paddle settlement.
 * This must run AFTER customerAccess(), which independently checks settlement
 * only when CUSTOMER_SETTLEMENT_PROOF_ENABLED=true.
 * A verified active pilot retains its separately scoped access.
 */
export function strictReportEntitlementReady(access,strictSettlementEnabled){
 if(!access||access.allowed!==true)return false;
 if(access.kind==='pilot')return true;
 if(access.kind==='paid')return strictSettlementEnabled===true;
 return false;
}
