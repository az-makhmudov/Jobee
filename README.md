# Jobee

Jobee helps candidates find relevant jobs, prepare truthful applications from verified information, and track employer activity. Its three main areas are **Explore**, **Applications**, and **Profile**. It serves students, early-career applicants and other individual job seekers, including people starting without a CV or employment history.

The current checkout includes multi-user authentication, public job discovery, grounded matching, persistent preparation and controlled browser submissions. The complete One-click Apply and shared-policy Autopilot experience remains under development. See [current status](docs/STATUS.md) for the distinction between local implementation, fixtures and deployed evidence.

## Stack

TypeScript across npm workspaces; React 19 and Vite 6; Fastify 5; Better Auth; PostgreSQL with Drizzle ORM and node-postgres; Playwright in a separate worker; local or S3-compatible document storage. The deployment container and CI use Node.js 24. Dependency manifests and `package-lock.json` determine exact installed versions. No Redis or external message broker is required.

## Repository

- `apps/web/`: Responsive React interface, document previews and browser tests
- `apps/api/`: Authentication, REST services, preparation, integrations and SPA hosting
- `apps/worker/`: Persistent browser execution and scheduled orchestration
- `packages/shared/`: Contracts, errors, logging, storage and common utilities
- `packages/config/`: Zod-validated runtime configuration
- `packages/database/`: Schema, SQL migrations, shared backend matching and submission services
- `scripts/`: Verification, tooling and asset preparation; inspect side effects before running
- `docs/`: Seven focused product, engineering and operations references
- `.github/workflows/`: Quality and browser CI
- `.railway/railway.ts`, `Dockerfile`: API/SPA and worker deployment configuration

Internal `@job-agent/*` package names and existing database identifiers are stable technical identifiers.

## Install and develop

Use Node.js 24, npm and an available PostgreSQL instance. CI exercises PostgreSQL 16. Create separate development and disposable test databases; localhost alone does not make data disposable.

```bash
npm ci
cp .env.example .env
```

Set development `DATABASE_URL` and a separate `TEST_DATABASE_URL` in the ignored `.env`. Generate distinct non-default `BETTER_AUTH_SECRET` and `EMAIL_TOKEN_ENCRYPTION_KEY` values, for example with `openssl rand -hex 32`. Never commit them. Configure `OWNER_EMAIL` for your own environment; do not assume the example identity is yours.

For offline development, leave provider credentials empty, use local storage, and set `ORCHESTRATOR_ENABLED=false`. An AI key can automatically select Gemini even when `AI_PROVIDER=disabled`; the configuration details are in [operations](docs/OPERATIONS.md). Avoid starting the worker against connected real accounts for an offline test.

```bash
npm run build:packages
npm run db:check
# Only after confirming DATABASE_URL identifies your intended local development database:
npm run db:migrate
npm run dev:api
```

Run `npm run dev:web` in another terminal. Vite serves the web client on port 5173 and proxies `/api` to port 3000. `npm run dev:worker` starts the worker explicitly; `npm run dev` starts all three processes and may run configured integrations. See [operations](docs/OPERATIONS.md) before enabling it.

## Verification

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run format
```

Integration tests must use the explicitly isolated test database. For reproducible UI unit tests set `VITE_API_URL=/api` for the test process. Browser verification uses `npm run test:ui` with a separately isolated loopback database. [AGENTS.md](AGENTS.md) defines required engineering checks; [operations](docs/OPERATIONS.md) explains safe database and browser setup.

## Documentation

New coding sessions normally read only [AGENTS.md](AGENTS.md), [master context](docs/MASTER_CONTEXT.md), and [status](docs/STATUS.md).

| Document                                 | Responsibility                                                     |
| ---------------------------------------- | ------------------------------------------------------------------ |
| [AGENTS.md](AGENTS.md)                   | Engineering workflow, authorization, verification and recovery     |
| [Master context](docs/MASTER_CONTEXT.md) | Product vision, users, journey, requirements and non-goals         |
| [Architecture](docs/ARCHITECTURE.md)     | Current components, data relationships and runtime boundaries      |
| [Policies](docs/POLICIES.md)             | Truthfulness, submission authorization, security and privacy       |
| [UX](docs/UX.md)                         | Current screens, interaction states and validation requirements    |
| [Roadmap](docs/ROADMAP.md)               | Remaining milestones in dependency order                           |
| [Status](docs/STATUS.md)                 | Latest evidence, limitations and continuation checkpoint           |
| [Operations](docs/OPERATIONS.md)         | Setup, deployment, monitoring, incidents and external dependencies |

Repository visibility is public, as verified on 2026-10-20. npm's `private: true` prevents package publication; it does not make GitHub private. Keep credentials, candidate records, uploads and operational exports out of Git. Public-launch privacy readiness and current production certification are separate questions from source availability.
