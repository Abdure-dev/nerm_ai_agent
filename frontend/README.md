# NERM AI Assistant frontend

This Next.js application contains the chat UI and the server-only NERM agent.
See the repository root `README.md` for architecture, setup, and production
requirements.

## Development

```bash
cp ../.env.example .env.local
# Add ENTERPRISE_PROJECT_ID and ENTERPRISE_APP_ID to .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Gemini Enterprise uses server-side Google Application Default Credentials; no
credentials are exposed through `NEXT_PUBLIC_` environment variables.

## Checks

```bash
npm run lint
npm run build
```
