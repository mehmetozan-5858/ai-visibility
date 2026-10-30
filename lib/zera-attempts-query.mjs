// The optional failure_reason column is added lazily for new ZERA attempts.
// Keep status reads compatible with historical tables that lack this column.
// Never interpolate user-controlled input into SQL.
export function zeraAttemptsSelectQuery(hasFailureReasonColumn=false){
 const extra=hasFailureReasonColumn===true?',failure_reason AS "failureReason"':'';
 return 'SELECT task_id AS "taskId",status,comparison_id AS "comparisonId"'+extra+' FROM zera_ai_task_attempts WHERE client_id=$1';
}
