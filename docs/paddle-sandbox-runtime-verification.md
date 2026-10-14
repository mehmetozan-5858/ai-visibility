# Paddle Sandbox runtime verification — 2026-10-13

Supersedes the credential/preview status in paddle-sandbox-integration.md.

Owner approved creation of AI Visibility — Sandbox Preview client token and preview-only connection. A public test_ client token was created and configured only for the paddle-sandbox-integration branch, target preview. PADDLE_ENVIRONMENT=sandbox and PADDLE_SANDBOX_ENABLED=true have the same narrow scope. No API key or live token was created.

Ready preview: https://ai-visibility-4eulejo1j-ai-visibility2.vercel.app/paddle-sandbox
Deployment: dpl_4B7C4QbjuUdqN2ABPWTgcVFqs2hN, source ce3d32422c828ca67efe4cb3f7d81ff340fd5003, target preview (API target=null).

Paddle Sandbox default payment link saved to this preview URL and shown approved. Vercel Deployment Protection remained enabled. Browser inspection used an existing temporary authenticated share link; that access URL is not recorded here.

Browser checks passed:
- Catalog renders all eight fixed digital services and four currency choices.
- TRY one-time Business Diagnosis checkout: due today TRY 4,990.00.
- EUR monthly Business Monitoring checkout: due today and next month EUR 159.00.
- USD monthly Business Monitoring checkout: due today and next month USD 169.00.
- GBP monthly Business Monitoring checkout: due today and next month GBP 139.00.
- All checkout dialogs visibly marked Test Mode. Forms left empty; no personal data or card information entered.

No transaction paid, subscription activated or completed webhook verified. Separate sandbox database and notification destination secret remain unconfigured. The handler fails closed until both are present, and never grants production access. No main merge or production deployment was performed. Full payment, cancellation, renewal and provisioning tests remain pending.
