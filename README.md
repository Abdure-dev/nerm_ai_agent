# UChicago NERM AI Assistant

An approval-aware AI assistant for University of Chicago NERM documentation,
profiles, pending work, and administrative tasks. The working application is a Next.js 16 chat
experience backed by Gemini Enterprise, with a local demo mode for development.

## What is implemented

- Multi-turn school-managed chat with session continuity
- School-account authentication through Google Application Default Credentials
- Gemini Enterprise answers with session continuity
- Useful local demo mode when Gemini Enterprise is not configured
- Read tools for pending items and profiles
- Grounded NERM documentation answers with citations
- NERM scope isolation that prevents unrelated workspace context from
  being used for profile, pending-item, and assignment requests
- Assignment-extension proposals that require explicit user approval
- Structured suggested actions, loading states, and error handling
- Input validation and a five-round tool-call limit

When neither remote provider is configured, the application uses a
clearly labeled deterministic demo agent. The NERM records and documentation
returned by the local tools are demo data. Replace the tool bodies in
`frontend/src/lib/nerm-agent.ts` with authenticated NERM API calls before
production use. Approval currently confirms a proposal in the conversation; it
does not submit an external write.

## Run locally

1. Install the Google Cloud CLI and authenticate:

   ```bash
   gcloud auth application-default login
   gcloud auth application-default set-quota-project YOUR_PROJECT_ID
   ```

2. Copy `.env.example` to `frontend/.env.local` and set
   `AI_PROVIDER=enterprise`, `ENTERPRISE_PROJECT_ID`, `ENTERPRISE_APP_ID`, and
   `ENTERPRISE_LOCATION`.
3. Start the application:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. Open `http://localhost:3000`.

## UChicago NERM RAG

The app is ready to use a Gemini Enterprise data store as its managed RAG
backend. Place approved local development source documents in
`knowledge-base/uchicago-nerm/`; they are intentionally ignored by Git.

After the documents have been indexed in a Gemini Enterprise data store, set
`ENTERPRISE_RAG_DATA_STORE` to the data store's full resource name. The chat
request then uses that data store for retrieval and displays the returned
grounding references as source cards.

## Validate

```bash
cd frontend
npm run lint
npm run build
```

## Production checklist

- Replace demo tool implementations with authenticated NERM/MCP calls.
- Resolve the signed-in user server-side; never accept identity from chat text.
- Add persistent audit logs and idempotency keys for approved writes.
- Verify authorization again when an approved action is submitted.
- Add rate limiting, monitoring, and representative agent evaluations.
