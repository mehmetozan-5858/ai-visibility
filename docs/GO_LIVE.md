# Go-live checklist

The repository now builds successfully in GitHub Actions.

## External setup still required
1. Connect this repository to a Next.js-compatible hosting account.
2. Provision a managed PostgreSQL database and set DATABASE_URL in the host.
3. Add supported AI provider credentials as server-side environment variables.
4. Configure billing only after test-mode checkout succeeds.
5. Enable monitoring and spending limits before live automated scans.

## Safety
Do not paste API keys into source files, screenshots, issues or chat messages. Store secrets in the hosting provider/GitHub secret store.
