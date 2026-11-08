// This legacy entry point must never start another provider attempt.
// The current guarded task workflow owns any separately approved execution.
export function createRetiredLegacyPost({authorize, checkOrigin}) {
  return async function POST(req) {
    const denied = await authorize(req);
    if (denied) return denied;
    const invalidOrigin = checkOrigin(req);
    if (invalidOrigin) return invalidOrigin;
    return Response.json({
      error: 'Legacy ZERA scan endpoint retired; use the guarded pilot workflow',
      code: 'legacy-zera-scan-retired',
      providerRequests: 0
    }, {status: 410, headers: {'Cache-Control':'private, no-store'}});
  };
}
