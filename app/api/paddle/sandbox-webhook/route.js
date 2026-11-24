import { verifyPaddleLiveSignature } from '../../../../lib/paddle-live.js';
import { recordSandboxEvidence, acceptsPaddleSandboxProviderId } from '../../../../lib/paddle-sandbox-evidence.js';
import { getDatabaseUrl } from '../../../../lib/db.js';

export const runtime = 'nodejs';

function databaseTarget(value) {
  try {
    const url = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || url.pathname.length < 2) return null;
    return {host: url.hostname.toLowerCase().replace(/-pooler(?=\.)/, ''), path: url.pathname};
  } catch {
    return null;
  }
}

export async function POST(req) {
  if (process.env.VERCEL_ENV !== 'preview' || process.env.PADDLE_SANDBOX_ENABLED !== 'true') {
    return Response.json({ error: 'Sandbox unavailable' }, { status: 404 });
  }
  const secret = process.env.PADDLE_SANDBOX_WEBHOOK_SECRET;
  const databaseUrl = process.env.PADDLE_SANDBOX_DATABASE_URL;
  const sandbox = databaseTarget(databaseUrl);
  const application = databaseTarget(getDatabaseUrl());
  if (!secret || secret === process.env.PADDLE_LIVE_WEBHOOK_SECRET ||
    !sandbox || !application || sandbox.host === application.host) {
    return Response.json({ error: 'Isolated Sandbox configuration required' }, { status: 503 });
  }
  const raw = await req.text();
  if (Buffer.byteLength(raw) > 262144) return Response.json({ error: 'Payload too large' }, { status: 413 });
  if (!verifyPaddleLiveSignature(raw, req.headers.get('paddle-signature'), secret)) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }
  let event;
  try { event = JSON.parse(raw); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!acceptsPaddleSandboxProviderId(event)) {
    return Response.json({ error: 'Not a provider Sandbox event' }, { status: 400 });
  }
  try {
    return Response.json(await recordSandboxEvidence(event, { databaseUrl }));
  } catch {
    return Response.json({ error: 'Sandbox event not recorded; retry required' }, { status: 503 });
  }
}
