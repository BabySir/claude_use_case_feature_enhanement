# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Internal Request Hub: employees submit requests, reviewers approve/reject them, admins see everything, and anyone who can see a request can comment on it. npm workspaces monorepo with `client/` (React 19 + Vite) and `server/` (Express 5 + SQLite via Node's built-in `node:sqlite`). Requires Node 22.13+ (for `node:sqlite`) and npm 10+. All code is ES modules.

## Imported context

The team rules and the accepted project docs are imported below. Follow the constitution's rules (R1–R9, W1–W7); they are not repeated here.

@constitution.md
@docs/domain.md
@docs/architecture.md

- In `docs/domain.md` and `docs/architecture.md`, every claim is labelled Confirmed, Inference or Open question. Don't treat an Open question as a requirement. The recommendations in `docs/architecture.md` §10 are **not implemented**.
- If you change behavior that these docs describe, update the affected statements too.

## Feature workflow: how to invoke the tools

Feature folders are `training/work/<feature-name>/` (e.g. `training/work/approve-or-reject/`); see constitution W1 and `training/work/README.md`. Copy blank templates from `training/work/_templates/`, and never fill in the templates themselves. Note: `/draft-intent-from-issue` still reads its template from `../../_templates/_templates/intent.md`.

- **Draft an intent from a GitHub issue:** `/draft-intent-from-issue <issue-ref> <feature-folder>`. The issue ref is a number (defaults to `mjinto/internal-request-hub`), `owner/repo#n`, or a URL. The output is always a draft.
- **Authorization review (every diff):** name the agent explicitly, e.g. "use authorization-reviewer on <changed files or pasted diff>". It is read-only and won't trigger from a generic "review my code". This folder isn't a git repo, so list the changed files.
- **Verification check (every diff, once plan.md has an Acceptance-to-evidence map):** `/verify-checkpoint <feature-folder>`. It runs test/lint/build, invokes authorization-reviewer, checks evidence per acceptance example, and ends with a PASS/FAIL recommendation. It edits nothing.
- `/code-review` and `/security-review` cover concerns outside the authorization boundary.

## Commands

Run from the repo root:

```bash
npm ci            # install
npm run dev       # API (:3001, node --watch) + Vite dev server (:5173, proxies /api to :3001)
npm test          # server tests (node --test, all server/test/*.test.js) then client tests (vitest run)
npm run lint      # ESLint for both workspaces
npm run build     # build client to client/dist
npm start         # production: server also serves client/dist on :3001
npm run db:reset  # delete and reseed server/data/request-hub.db
```

Single tests:

```bash
# server (Node test runner)
cd server && node --test --test-name-pattern="reviewer" test/app.test.js
# client (Vitest)
cd client && npx vitest run src/components/RequestDetails.test.jsx -t "test name"
```

CI (`.github/workflows/ci.yml`) runs `npm ci`, `lint`, `test`, `build` on Node 22.

Server env vars: `PORT` (default 3001) and `DB_FILE` (default `server/data/request-hub.db`).

## Working notes

These are code-level details that aren't in the constitution.

**Server modules.**
- Routes in `app.js` call a domain module: `requests.js` for requests, `comments.js` for comments. `comments.js` gets its access rule only from `getVisibleRequest`; don't add comment access rules anywhere else.
- `createApp({ db })` takes the db as an argument, so tests can use `createDatabase(":memory:")`. When `client/dist` exists, it also serves the SPA with a catch-all route.
- Visibility is written twice: `visibilityClause` (list, SQL) and `canViewRequest` (JS, used by `getVisibleRequest` and `loadDecidableRequest`). Keep them in sync, and don't add a third copy.
- Approve/reject write the status `UPDATE` and a `request_decisions` row together via `transaction` (exported from `db.js`). Reuse that helper for any multi-statement write.
- Request queries reuse the `requestSelect` SQL, and comment queries reuse `commentSelect`. Both return camelCase fields (`requesterId`, `assignedReviewerName`, `authorName`, …) that the client consumes directly.
- Denials: `throw new HttpError(status, CODE, message)`, and the route passes it to `next(error)`. Statuses ≥500 are logged.
- `db.js`: `createDatabase()` runs idempotent `CREATE TABLE IF NOT EXISTS` migrations and seeds data only when `users` is empty. There is no migration framework. Additive tables reach existing local DBs on the next start. Changes to existing tables need `npm run db:reset`.

**Seed data is load-bearing.** The server tests assert on specific seeded IDs (users 1–6, where user 6 is an inactive reviewer; requests 101–105) and on ordering. Changing the seed will break tests.

**Server tests share one in-memory DB** across the whole `server/test/app.test.js` file (created in `before`). Mutating tests (approve/reject/cancel) affect later tests, so order matters.
- Blocks insert their own fixture rows outside 101–105: approve/reject uses 201–205, and comments (the last block) uses 301–302.
- A `--test-name-pattern` run skips earlier blocks, so order-dependent tests can fail in isolation. For example, the approve/reject block's cancelled-request test expects 101 to have been cancelled by the cancel block. Confirm with a full `npm test`.
- `server/test/comments-http.test.js` and `server/test/decisions-http.test.js` each use their own DB and an ephemeral port (`createApp` + `listen(0)` + `fetch`).

**Client.**
- `App.jsx` owns all state (users, current user, request list, selected request and its comments, error) and passes callbacks down to the presentational components.
- `api.js` wraps `fetch`, unwraps `.data`, and throws `Error(error.message)` from the server's error envelope, which App shows in an alert banner. After each request mutation, App refetches the list.
- Client tests stub `global.fetch` with `vi.stubGlobal` and match on exact URL strings, including the query string, so any change to URL shape must also be made in the tests. `App.test.jsx` calls `cleanup()` in `afterEach`.
