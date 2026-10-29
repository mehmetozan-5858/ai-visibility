/**
 * AI Visibility AI Bridge readiness, without revealing server credentials.
 * Readiness is not proof of provider connectivity or actual inference.
 */
export function bridgeTrialReadiness(env = {}) {
  const enabled = env.AI_BRIDGE_INFERENCE_ENABLED === "true";
  const keyConfigured = typeof env.OPENROUTER_API_KEY === "string" && env.OPENROUTER_API_KEY.trim().length > 0;
  return {
    inferenceEnabled: enabled,
    serverKeyConfigured: keyConfigured,
    configuredForTrial: enabled && keyConfigured,
    inferenceVerified: false,
    productionModulesEnabled: false,
    nextAction: !enabled ? "enable-only-for-approved-trial" :
      !keyConfigured ? "configure-private-server-key" : "run-explicit-admin-test",
  };
}
