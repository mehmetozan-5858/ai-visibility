# Synthetic browser session for Sandbox checkout

A protected Sandbox preview can now create a distinct server-owned synthetic test identity without reading production customer records or opening production login routes. POST /api/paddle-sandbox/test-session accepts an empty same-origin JSON object, applies rate limiting and sets a Secure, HttpOnly, SameSite=Strict host-only cookie valid for one hour. The identity is a server-generated UUID; buyer-supplied IDs are not accepted. A purpose-separated HMAC signature uses the existing server-only Sandbox notification secret and is rejected outside Sandbox preview/development, on expiry or tampering. This fixture is not a real customer registration/login or a production entitlement.

The page now uses the same session verifier as the checkout-intent/account endpoints. Each fixture session can create an opaque checkout intent, complete real Sandbox checkout, and view only its signed provider records. Legacy authenticated client sessions remain supported. An invalid fixture cookie does not fall back to a different actor. Vercel deployment protection remains enabled.

Validation: 310 tests pass; local Next.js build passes. Browser checkout and provider-bound status verification remain pending until performed after preview publication.
