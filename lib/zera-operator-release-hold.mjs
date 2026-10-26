/** Explicit, non-configurable release hold for ZERA operator-triggered provider calls.
 * Free-tier labels, environment flags, customer confirmation and local attempt
 * accounting are NOT provider-enforced zero-cost guarantees.
 * A separately reviewed change and human approval are required to release.
 */
export function assessZeraOperatorRelease() {
  return Object.freeze({
    allowed: false,
    reason: 'Provider execution paused pending verified cost enforcement and explicit release approval',
  });
}
