/**
 * Review-only release hold for ZERA's billable provider requests.
 * Local estimates, a user-supplied flag, and a database reservation are not
 * proof of a provider-enforced zero-cost limit. Never turn these into approval.
 * Remove this hold only in a separately reviewed, explicitly approved change
 * with verifiable provider-side enforcement and release controls.
 */
export function assessZeraProviderSpendGate(env = {}) {
  const previewIsolationConfirmed = env.VERCEL_ENV === 'preview' &&
    env.ZERA_ISOLATED_PREVIEW_DB === 'verified';
  return Object.freeze({
    allowed: false,
    reason: 'Provider execution paused pending verified provider-side cost enforcement and release approval',
    previewIsolationConfirmed,
    providerSideHardCapVerified: false,
  });
}
