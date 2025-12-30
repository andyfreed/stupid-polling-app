# Poll Aggregator App (Free-first)

Next.js (App Router) + Prisma + Postgres app that ingests and normalizes polling data from:

- VoteHub Polling API (CC BY 4.0): `https://votehub.com/polls/api/`
- civicAPI (attribution required): `https://civicapi.org/api-documentation`

## Quickstart (local)

### 1) Install deps

```bash
pnpm install
```

### 2) Configure env

This environment blocks committing `.env.example`, so we ship `env.example` instead.

```bash
copy env.example .env
```

Edit `.env` if needed.

### 3) Start Postgres

```bash
pnpm db:up
```

### 4) Run migrations

```bash
pnpm prisma:migrate
```

### 5) Ingest data

```bash
pnpm ingest
```

### 6) Run the app

```bash
pnpm dev
```

Open the UI at `http://localhost:3000/subjects`.

## Auto-deploy to Vercel (no local testing)

This repo includes a GitHub Actions workflow that **deploys to Vercel on every push to `main`**.

### 1) Create a Vercel project (one-time)

In Vercel, create a new project connected to this GitHub repo.

### 2) Add GitHub repo secrets (one-time)

In GitHub → repo → Settings → Secrets and variables → Actions, add:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

You can find `ORG_ID` / `PROJECT_ID` in Vercel project settings, or by running `vercel env ls` locally (optional).

### 3) Add `DATABASE_URL` in Vercel

Set these in Vercel project environment variables (Production + Preview as you prefer):

- `DATABASE_URL`: **Supabase pooled/transaction** URL (recommended for serverless runtime)
- `DIRECT_URL`: **Supabase direct** connection URL (recommended for Prisma migrations)

After that: **just push to `main`** and it will deploy automatically.

## Scripts

- `pnpm db:up` / `pnpm db:down`: start/stop Postgres via Docker
- `pnpm prisma:migrate`: run Prisma migrations
- `pnpm ingest`: ingest VoteHub + civicAPI into Postgres

## API

- `GET /api/subjects`
- `GET /api/polls?subject=&pollType=&from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /api/series/approval?subject=`

## Attribution

If you deploy this publicly, keep the footer attribution links intact:

- VoteHub docs: `https://votehub.com/polls/api/`
- civicAPI docs: `https://civicapi.org/api-documentation`
