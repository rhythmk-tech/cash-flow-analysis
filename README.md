# Cash Flow Forecaster

A multi-tenant weekly cash flow forecasting tool. Each company gets its own account, adds its
income/expense line items (manually or via CSV import), and gets charts, scenario planning, and
plain-English insights built from that data.

## Stack

- Next.js 16 (App Router), React 19
- Prisma + SQLite (`prisma/dev.db`) for storage
- NextAuth v5 (Credentials provider, JWT sessions) for auth
- Vitest for unit tests (`lib/forecast.ts`, `lib/export.ts`, `lib/rate-limit.ts`)

## Running locally

```bash
npm install
npx prisma migrate dev   # creates/updates prisma/dev.db
npm run dev              # http://localhost:3000
```

Run tests with `npm test`. Type-check with `npx tsc --noEmit`.

## Data model

- `User` — one row per login. A user is either a **company** (their own forecast data:
  `startingBalance`, `totalWeeks`, line items, overrides) or a **team member**
  (`activeCompanyId` points at another user's row, and all reads/writes are scoped to that
  company instead of their own). See `lib/session.ts`'s `requireCompanyId()` — every API
  route resolves this fresh from the database on each request rather than trusting a cached
  session claim, so removing someone from a team takes effect immediately.
- `LineItem` / `Override` — income/expense entries and manual overrides, scoped by the owning
  company's `userId`.
- `Invitation` — pending team invites (7-day expiry).
- `PasswordResetToken` — one-hour-expiry reset tokens.

## Known limitations / things to change before a real production deploy

**No email provider is configured.** Team invites and password resets generate a real link and
token in the database, but instead of emailing it, the link is logged to the server console and
shown directly on screen (clearly labeled as such). Before shipping this for real users, wire up
an email provider (Resend, Postgres-backed queue, SES, etc.) in `app/api/team/invite/route.ts`
and `app/api/forgot-password/route.ts` and stop returning the raw link in the API response.

**Rate limiting is in-memory** (`lib/rate-limit.ts`), scoped to a single Node process. It's
enough to slow down casual abuse locally, but a real multi-instance deployment needs a shared
store (Redis, Upstash, etc.) or it resets per-instance and per-restart.

**SQLite is a single-file database**, fine for local development but not for concurrent
production traffic. To move to Postgres:

1. Provision a Postgres database and get its connection string.
2. In `prisma/schema.prisma`, change the datasource block:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
3. Set `DATABASE_URL` in your production environment to the Postgres connection string.
4. Run `npx prisma migrate deploy` against it (this replays the existing migration history —
   it was written against SQLite but uses only portable types, so it should apply cleanly;
   verify in a staging environment first).
5. Remove `prisma/dev.db` from local dev usage only if you also switch local dev to Postgres —
   otherwise keep SQLite for local and Postgres for deployed environments via `.env` vs
   platform env vars.

**Secrets.** `.env*` is already gitignored — never commit it. `AUTH_SECRET` in `.env` is a
locally generated dev value; generate a fresh one per environment
(`openssl rand -base64 32` or `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`)
and set it via your hosting platform's secret manager, not in a committed file.

**No granular team roles.** Team membership is binary: the owner (the account that created the
company) can invite/remove members and everyone else is a member with full read/write access to
the shared forecast. There's no view-only or per-section permission model.
