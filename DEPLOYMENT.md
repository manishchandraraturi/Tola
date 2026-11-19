# Deploying Tola

Tola is a Next.js 16 app (App Router) with Prisma. Build and run:

```bash
npm install          # runs "postinstall": prisma generate
npm run build        # next build (also type-checks)
npm run start        # next start
```

`npm run start` serves the production build on http://localhost:3000.

## Database

`prisma/schema.prisma` currently uses SQLite for local development:

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

**For Vercel deployment, change the provider to `postgresql` and update `DATABASE_URL`.**

A serverless host has no writable disk, so a `file:` database will not work there:

1. Provision a Postgres database and set `DATABASE_URL` to its connection string.
2. Change the datasource block to:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
3. Run `npx prisma generate`, then `npx prisma db push` (or `prisma migrate deploy`
   if you use migrations) against that database.
4. Seed the demo story once with `POST /api/seed`, or create the jeweller pin in
   `/api/auth/login` flow as the app expects.

## Environment variables

Set these in the hosting dashboard (see `.env.example`):

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Prisma connection string |
| `AUTH_SECRET` | yes in production | Signs the session cookie in `src/lib/auth.ts`. Without it a dev fallback is used, which is unsafe on the public internet. |
| `NEXT_PUBLIC_DEMO` | recommended | `"1"` shows demo affordances (demo login hint, ledger tamper button). Use `"0"` for a real deployment. |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` | no | WhatsApp Cloud API; falls back to `DEMO_SMS` logging. |
| `OPENAI_API_KEY` | no | Enables the Scribe voice/photo routes. |

`.env` is git-ignored and must never be committed. `.env.example` holds placeholders only.

## Public pages

These need no login and are safe to share:

- `/status/[token]` — customer progress view (whitelisted fields only)
- `/passport/[token]` — karigar passport (no phone numbers, jeweller names or rupee amounts)
- `/refiner/[token]` — refiner logged-recovery entry
- `/statement/[slipId]`, `/statement/karigar/[karigarId]` — printable statements
