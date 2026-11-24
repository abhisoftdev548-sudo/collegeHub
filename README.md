# CollegeHub

College management and event-operations platform for **Pundit Dev Prabhakar Shashtri College** — academics, students, attendance, events, competitions, volunteers, announcements and reports in one application.

- **Backend** — Express 4 + TypeScript + Mongoose, cookie-based JWT sessions with refresh rotation, permission + data-scope enforcement, one REST API under `/api`.
- **Frontend** — Next.js 15 App Router statically exported, served by the same Express process in production (`backend/public`).
- **Deployment** — a single Docker image serving both the API and the UI on port `5000`.

---

## Contents

1. [Feature overview](#feature-overview)
2. [Architecture](#architecture)
3. [Quick start (development)](#quick-start-development)
4. [Environment variables](#environment-variables)
5. [Roles and permissions](#roles-and-permissions)
6. [Scheduled delivery (cron)](#scheduled-delivery-cron)
7. [Production build](#production-build)
8. [Docker deployment](#docker-deployment)
9. [API reference](#api-reference)
10. [Scripts](#scripts)
11. [Project layout](#project-layout)
12. [Troubleshooting](#troubleshooting)

---

## Feature overview

| Area | What it covers |
| --- | --- |
| Academics | Departments, courses, academic sessions, semesters, sections, subjects, teaching assignments, class representatives |
| People | Student records with CSV import/export and one-time credentials, teacher accounts, semester promotion (preview → approve) with an append-only enrollment history |
| Attendance | Per-subject/section class sheets, marking with remarks, percentages and CSV reports; event check-in via code, QR or staff scan |
| Events | Main events and sub-events, dynamic registration forms, registration approvals, payments with server-side verification, exports |
| Competitions | Per-event competitions, team or individual entries, submissions review with scores, results and publication |
| Volunteers | Volunteer groups per event with leaders and members, task assignment, progress updates |
| Communication | Scoped announcements (college/department/course/semester/section/event/volunteer group) with priority, scheduling and notification fan-out; in-app notifications |
| Operations | Dashboards per role, academic/workload/engagement reports, activity audit log, platform settings |

Student-facing screens round it out: **Explore events**, **My registrations** (with payment reference submission), **My attendance**, plus **My subjects** / **My students** for teachers, **My class** for class representatives and a **Volunteer hub**.

## Architecture

```
┌─────────────────────────┐      ┌──────────────────────────┐
│  Next.js static export  │ ───► │  Express 4 + TS (API)    │ ───► MongoDB
│  frontend/out           │ API  │  /api/*                  │
└─────────────────────────┘      │  /            (app shell)│
                                 │  /uploads     (files)    │
                                 └──────────────────────────┘
```

- The frontend is a fully static export (`output: 'export'`), so there is no Node runtime for it in production.
- Detail screens are static routes that take identifiers as query parameters (`/dashboard/events/detail?id=…`), keeping the export compatible with any static host.
- In development, Next.js rewrites `/api` and `/uploads` to the Express server (`NEXT_PUBLIC_API_PROXY`, default `http://127.0.0.1:5000`), so the browser only ever talks to one origin.

### Security model

- **Sessions** — short-lived access JWT in an HttpOnly cookie plus a rotating refresh token; re-use of a rotated refresh token revokes the session family.
- **CSRF** — double-submit cookie: `GET /api/auth/csrf` sets `ch_csrf` (non-HttpOnly) and state-changing requests must echo it in `x-csrf-token`.
- **Authorisation** — a permission set is derived per user (role base + responsibilities + granted extras). Services additionally enforce *data scope*: teachers only see their departments, sections, subjects and events.
- **Validation** — every request body/query is validated with strict Zod schemas; unknown keys are rejected.
- **Payments** — amounts are always derived server-side from the event/competition configuration, and a payment only becomes `paid` through an authorised verification call.
- **Audit** — security-relevant actions are appended to an audit log with actor, IP and user agent.

## Quick start (development)

Requirements: **Node.js 20+** and a **MongoDB** instance (local, Docker, or Atlas).

```bash
# 1. install dependencies for both workspaces
npm run install:all

# 2. configure the backend
cp backend/.env.example backend/.env      # then edit secrets + MONGODB_URI

# 3. create the first administrator
npm run bootstrap:admin

# 4. run the API (http://localhost:5000) and the web app (http://localhost:3000)
npm run dev:backend      # terminal 1
npm run dev:frontend     # terminal 2
```

Sign in at <http://localhost:3000/login> with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `backend/.env`.

Optional demo data (students, teachers, sections, events, a competition, payments):

```bash
SEED_DEMO_DATA=true npm run seed:demo
```

> Demo seeding is destructive to matching collections — use it only on a development database.

## Environment variables

All backend settings live in `backend/.env` (see `backend/.env.example`).

| Variable | Default | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `development` | Enables production-only hardening when set to `production` |
| `PORT` | `5000` | HTTP port (bound to `0.0.0.0`) |
| `MONGODB_URI` | — | MongoDB connection string |
| `JWT_ACCESS_SECRET` | — | Access token signing key (long random string) |
| `JWT_REFRESH_SECRET` | — | Refresh token signing key (different from the above) |
| `ACCESS_TOKEN_TTL` | `15m` | Access token lifetime |
| `REFRESH_TOKEN_TTL_DAYS` | `7` | Refresh token lifetime in days |
| `COOKIE_SECURE` | `false` | Set to `true` behind HTTPS |
| `CORS_ORIGINS` | empty | Comma-separated extra origins allowed to call the API |
| `UPLOAD_DIR` | `uploads` | Directory for uploaded files |
| `MAX_UPLOAD_MB` | `10` | Maximum upload size |
| `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | — | First administrator created by `bootstrap:admin` |
| `SEED_DEMO_DATA` | `false` | Allows the demo seeding script to run |

The frontend only needs one optional variable in `frontend/.env.local`:

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_PROXY` | `http://127.0.0.1:5000` | Dev-server proxy target for `/api` and `/uploads` |

## Roles and permissions

| Role | Baseline capabilities |
| --- | --- |
| **Admin** | Everything, including settings, teachers, promotions, payments verification and the audit log |
| **Teacher** | Events (create/update, volunteers), student read/update, attendance, competitions, forms, registrations read, submissions review, announcements, reports |
| **Student** | Event browsing and registration, announcements, own tasks |
| **CR** *(responsibility)* | Adds class-level visibility: own class roster, section attendance reads, class announcements |
| **Volunteer** *(responsibility)* | Adds own tasks and announcement reads |

Responsibilities are carried on the user (`responsibilities[]`) and resolved into permissions at request time; extra permissions can be granted per teacher by an administrator. Data scope is enforced separately — a teacher's "student:read" only reaches the sections they teach.

## Scheduled delivery (cron)

Announcements can be scheduled by setting `publishAt` in the future. They are delivered to notification inboxes when due, by a maintenance job that is safe to run as often as you like:

```bash
# development
npm --prefix backend run publish:scheduled

# compiled production build
node backend/dist/scripts/publishScheduledAnnouncements.js
```

- The job selects `published: true`, `publishAt <= now`, `notifiedAt` unset, fans the announcement out to its audience, and stamps `notifiedAt` so re-runs never duplicate notifications.
- Announcements created without a future date are fanned out immediately (and stamped) at creation time.
- Recommended schedule: every 5 minutes.

**cron entry**

```cron
*/5 * * * * cd /srv/collegehub && node backend/dist/scripts/publishScheduledAnnouncements.js >> /var/log/collegehub-cron.log 2>&1
```

**Render / Railway / Fly.io** — add a scheduled job (Render: *Cron Job*, Railway: *Cron Schedule*, Fly: `fly machine run`) with the same command. Any scheduler that runs a one-off container/process on an interval works; the job needs the same `MONGODB_URI` as the app.

## Production build

```bash
npm run build     # exports the frontend, compiles the API, copies the export into backend/public
npm start         # node backend/dist/server.js — serves API + UI on :5000
```

What `npm run build` does:

1. `frontend/next build` → static export in `frontend/out`
2. `backend/tsc` → compiled API in `backend/dist`
3. `scripts/copy-frontend.js` → copies `frontend/out` to `backend/public`

The Express server serves `backend/public` with `extensions: ['html']`, resolves pages before same-named directories (so `/dashboard/explore` and `/dashboard/explore/detail` both work), and falls back to `index.html` for client-side routes. `/api/*` and `/uploads/*` are never swallowed by the fallback.

## Docker deployment

The image builds the frontend and backend in one stage, then ships only production dependencies:

```bash
docker build -t collegehub .

docker run -d --name collegehub \
  -p 5000:5000 \
  -e MONGODB_URI="mongodb+srv://…/collegehub" \
  -e JWT_ACCESS_SECRET="…" \
  -e JWT_REFRESH_SECRET="…" \
  -e COOKIE_SECURE=true \
  -e ADMIN_EMAIL="admin@example.edu" \
  -e ADMIN_PASSWORD="ChangeMe123!" \
  -v collegehub-uploads:/app/uploads \
  collegehub
```

Notes:

- Run `bootstrap:admin` once against the same database — start the container with the same environment and exec it: `docker exec collegehub node dist/scripts/bootstrapAdmin.js`.
- Mount `/app/uploads` if you want uploaded files to survive container replacement.
- The image includes a `HEALTHCHECK` hitting `/api/health`, which reports database connectivity.
- Behind a reverse proxy, terminate TLS there and set `COOKIE_SECURE=true`; the container itself speaks plain HTTP on `5000`.

## API reference

Every response uses the envelope `{ success, data, message? }`; collections are returned with `{ success, data: [], pagination }`. Errors are `{ success: false, error: { code, message, details? } }`. **All resource identifiers are `_id`.**

| Group | Base path | Highlights |
| --- | --- | --- |
| Auth | `/api/auth` | `csrf`, `login`, `logout`, `refresh`, `me`, `change-password`, `profile` |
| Academics | `/api/academic` | `departments`, `courses`, `sessions`, `semesters`, `sections`, `subjects`, `teaching-assignments`, `class-representatives` |
| Students | `/api/students` | list/filter, `export`, `import`, `import-template`, `:id/history`, `:id/status`, `:id/reset-password`, `:id/placement` |
| Promotions | `/api/promotions` | `preview`, create batch, `:id/approve`, `:id/cancel` |
| Teachers | `/api/teachers` | CRUD, `:id/suspend`, `:id/reset-password`, `me/overview`, `me/students` |
| Events | `/api/events` | events, categories, `forms` (+`:id`), sub-events, `:id/register`, `my-registrations`, `my-payments`, registrations + approval, payments (`payments/order`, `payments/:paymentId/reference`, `payments/:paymentId/verify`), registration export |
| Competitions | `/api/competitions` | CRUD, `:id/submissions`, `submissions/:submissionId/review`, `:id/results`, `:id/publish`, `my-submissions`, `my-results` |
| Volunteers | `/api/volunteers` | `groups`, `my-groups`, `groups/:id/volunteers` |
| Tasks | `/api/tasks` | list, `my`, create, update with status/note, delete |
| Attendance | `/api/attendance` | `sheet`, `roster`, save, `history`, `report`, `report/export`, `me` |
| Event attendance | `/api/event-attendance` | `:eventId` overview, `check-in`, `check-in/qr`, `check-in/staff`, `me` |
| Announcements | `/api/announcements` | list (manage scope), `me`, create, update, delete, mark read |
| Notifications | `/api/notifications` | list (`{items, unreadCount}`), `read` |
| Dashboard | `/api/dashboard` | role-aware dashboard payloads |
| Reports | `/api/reports` | `academic`, `academic/export`, `teacher-workload`, `engagement`, `audit-logs` |
| Settings | `/api/settings` | read/update platform identity, access and payment settings |
| Search | `/api/search` | cross-entity quick search |
| Health | `/api/health` | unauthenticated liveness + database status |

## Scripts

| Command | Description |
| --- | --- |
| `npm run install:all` | Install backend and frontend dependencies |
| `npm run dev:backend` / `dev:frontend` | Development servers (tsx watch / Next dev) |
| `npm run build` | Production build of both workspaces + copy export into `backend/public` |
| `npm start` | Start the production API (serves the UI too) |
| `npm run typecheck` | TypeScript checks for both workspaces |
| `npm run bootstrap:admin` | Create or promote the first administrator (idempotent) |
| `npm run seed:demo` | Seed demo data (requires `SEED_DEMO_DATA=true`) |
| `npm --prefix backend run publish:scheduled` | Deliver due scheduled announcements |

## Project layout

```
collegehub/
├── backend/
│   ├── src/
│   │   ├── config/        env, database, logger, constants
│   │   ├── models/        Mongoose models
│   │   ├── middleware/    auth, rbac, csrf, validation, errors, rate limiting
│   │   ├── validators/    strict Zod schemas
│   │   ├── services/      business logic + data-scope rules
│   │   ├── controllers/   thin HTTP adapters
│   │   ├── routes/        API route groups
│   │   ├── scripts/       bootstrapAdmin, seedDemo, publishScheduledAnnouncements
│   │   └── app.ts         Express app (API + static frontend)
│   └── public/            generated: static frontend export
├── frontend/
│   └── src/
│       ├── app/           App Router pages (public + /dashboard)
│       ├── components/    ui, shared, feature components
│       ├── lib/           API client, utilities, navigation
│       ├── providers/     auth, query client
│       └── types/         shared API types
├── scripts/copy-frontend.js
├── Dockerfile
└── README.md
```

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `Invalid CSRF token` | The `ch_csrf` cookie is missing or stale — reload the page (the client primes it via `GET /api/auth/csrf`). |
| Login succeeds then the app bounces to `/login` | Cookies are blocked or `COOKIE_SECURE=true` without HTTPS. |
| `401` on every request in production | Behind a proxy, forward the `Cookie` header and make sure the API is called same-origin. |
| Deep links 404 after deploying | Re-run `npm run build` so `backend/public` is populated, then restart the server. |
| Scheduled announcements missing | The cron job is not running or `publishAt` is still in the future — run `publish:scheduled` manually to check. |
| Attendance percentages look wrong | "Late" counts as attended; absentees are only counted from sheets that were actually marked. |

---

© Pundit Dev Prabhakar Shashtri College · CollegeHub
