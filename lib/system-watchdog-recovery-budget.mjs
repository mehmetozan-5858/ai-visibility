// Keep watchdog recovery within a small portion of its scheduled HTTP budget.
// The remaining stale components are eligible for later cycles.
export const MAX_WATCHDOG_RECOVERIES_PER_RUN=2;
export const WATCHDOG_RECOVERY_TIMEOUT_MS=8000;

export function boundedWatchdogRecoveries(recoveries){
  if(!Array.isArray(recoveries))return [];
  return recoveries.slice(0,MAX_WATCHDOG_RECOVERIES_PER_RUN);
}
