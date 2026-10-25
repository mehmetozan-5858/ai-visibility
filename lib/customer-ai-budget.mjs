/** Conservative preflight reservations, in USD cents. Not a provider-side spend cap. */
export const PILOT_BUDGET_CENTS=100;
export const RESERVED_CENTS_PER_CALL=10;
export function assessPilotBudget({spentCents=0,reservedCents=0,requests=1}={}){
 if(!Number.isSafeInteger(spentCents)||spentCents<0||!Number.isSafeInteger(reservedCents)||reservedCents<0||!Number.isSafeInteger(requests)||requests<1||requests>3)throw Error('Invalid budget input');
 const required=requests*RESERVED_CENTS_PER_CALL;
 return {allowed:spentCents+reservedCents+required<=PILOT_BUDGET_CENTS,requiredCents:required,budgetCents:PILOT_BUDGET_CENTS,remainingAfterReservationCents:Math.max(0,PILOT_BUDGET_CENTS-spentCents-reservedCents-required),hardCap:false};
}
