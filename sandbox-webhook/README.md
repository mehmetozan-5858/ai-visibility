# Isolated Paddle Sandbox webhook service

Deploy only this rootDirectory to a separate Vercel project. No production routes, production credentials, scheduled jobs, checkout or live payment capabilities are included. The handler is disabled outside preview/development.

Required preview-only configuration: PADDLE_SANDBOX_ENABLED=true, PADDLE_ENVIRONMENT=sandbox, PADDLE_SANDBOX_DATABASE_URL (isolated test database), PADDLE_SANDBOX_WEBHOOK_SECRET. Do not attach the main project integration or copy its environment.

Endpoint: POST /api/webhooks/paddle-sandbox. Non-POST returns 405. Requires fresh raw-body Paddle HMAC signature and a catalog-known sandbox price. Duplicate and out-of-order handling use the same verified recorder as the application.

Before enabling provider delivery, obtain explicit approval to create an automation access key scoped to this separate project and transmit its webhook URL to Paddle Sandbox. Revoke the exact key and deactivate the destination after testing. Never use a main-project automation bypass.

Copied billing libraries and tests must stay synchronized with ../lib and ../tests during future edits. There is intentionally no automatic deployment connection.
