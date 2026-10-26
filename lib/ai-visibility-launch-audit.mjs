import {randomUUID} from "node:crypto";

/**
 * AI Visibility launch: validated, privacy-minimized audit event envelope.
 * This is pure preparation, NOT a persistence or sending function.
 */
const validId = value => typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value);
const eventKinds = new Set(["authorization-allowed","authorization-denied","report-prepared","agent-plan-prepared","approval-requested","service-error"]);
export function prepareLaunchAuditEvent({tenantId,actorId,serviceId,eventType,sourceId,occurredAt}={}) {
  if (![tenantId,actorId,serviceId].every(validId)) return {ok:false,reason:"invalid-scope"};
  if (!eventKinds.has(eventType)) return {ok:false,reason:"invalid-event-type"};
  if (sourceId !== undefined && !validId(sourceId)) return {ok:false,reason:"invalid-source"};
  const at=occurredAt === undefined ? new Date().toISOString() : occurredAt;
  if (typeof at !== "string" || !Number.isFinite(Date.parse(at)) || new Date(at).toISOString() !== at) {
    return {ok:false,reason:"invalid-timestamp"};
  }
  return {ok:true,event:{
    id:randomUUID(),tenantId,actorId,serviceId,eventType,
    sourceId:sourceId ?? null, occurredAt:at,
    schemaVersion:1, state:"prepared-not-persisted",
  }};
}
