/**
 * AI Bridge model inference is deliberately not released for AI Visibility.
 * Environment flags, free-model labels and configured keys are not proof of
 * enforceable zero spend or an approval to make provider requests.
 * Keep this non-configurable until a separately reviewed release is approved.
 */
export function assessBridgeInferenceRelease() {
  return Object.freeze({
    allowed: false,
    reason: "inference-release-not-approved",
  });
}
