# Deployment

The app is structured for a Node-compatible Next.js host. Keep all API keys in deployment environment variables, never in Git.

## Required before production
- persistent managed database
- authentication
- provider API credentials
- billing provider credentials
- rate limits and spend caps
- error monitoring

## Current mode
Safe demo. Scheduled workflow performs no paid provider calls and sends no outbound messages.
