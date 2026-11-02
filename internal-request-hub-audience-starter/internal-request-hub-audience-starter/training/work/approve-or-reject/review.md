# Review: Approve or reject an assigned request

Specification: training/work/approve-or-reject/spec.md (accepted 2026-10-31)
Plan: training/work/approve-or-reject/plan.md (accepted 2026-10-31)
Code revision: working tree as of 2026-10-31. Not a git repository, so there is no commit; changed files are listed below.
Reviewer: Technical reviewer — Sagar Sharma (accepted 2026-10-31)

Changed files:
- **Server:** `server/src/db.js`, `server/src/requests.js`, `server/test/app.test.js`, `server/test/decisions-http.test.js` (new)
- **Client:** `client/src/App.jsx`, `client/src/components/RequestDetails.jsx`, `client/src/components/RequestDetails.test.jsx`
- **Docs and tooling:** `docs/domain.md`, `docs/architecture.md`, `.claude/agents/authorization-reviewer.md`

## Verification evidence

All rows below were actually executed on 2026-10-31 unless marked "not run".

**Checks after each checkpoint**

| Command or scenario | Result | Evidence |
| --- | --- | --- |
| `npm test` after checkpoint 1 (schema + exported `transaction`) | pass | Exit 0. Server 45/45, client 14/14. |
| `npm test` after checkpoint 2 (rules + domain tests) | pass | Exit 0. Server 51/51 (approve/reject block 18 tests), client 14/14. |
| `npm test` after checkpoint 3 (HTTP tests) | pass | Exit 0. Server 61/61, client 14/14. |
| `npm test` after checkpoint 4 (client) | pass | Exit 0. Server 61/61, client 19/19. |
| `npm test` after checkpoint 5 (docs and tooling) | pass | Exit 0. Server 61/61, client 19/19. |
| `npm run lint` after each checkpoint 1–5 | pass | Exit 0 each time |
| `npm run build` after each checkpoint 1–5 | pass | Exit 0 each time ("✓ built") |
| Local dev DB gains `request_decisions` without a reset (checkpoint 1) | pass | A read-only `sqlite_master` query on `server/data/request-hub.db` after the dev server's `--watch` restart listed `request_decisions`. |

**API walkthrough** on a throwaway DB: temporary server on :3102 with `DB_FILE` in the scratchpad. The developer's local DB wasn't used or reset.

| Command or scenario | Result | Evidence |
| --- | --- | --- |
| AR-10: Daniel approves 101 | pass | 404 `{"error":{"code":"REQUEST_NOT_FOUND","message":"Request not found."}}` |
| AR-12: Maya (requester) approves 101 | pass | 403 `REQUEST_FORBIDDEN` "You cannot decide this request." |
| AR-14: Alex (admin) approves 101 | pass | 403 `REQUEST_FORBIDDEN` "You cannot decide this request." |
| AR-40: Priya approves 102, which she can't view | pass | 404 `REQUEST_NOT_FOUND` "Request not found." |
| AR-41: Alex approves 102, which is Approved | pass | 403 `REQUEST_FORBIDDEN`, not 409 |
| AR-42: Alex rejects 103 with an empty comment | pass | 403 `REQUEST_FORBIDDEN`, not 400 |
| 101 unchanged after the refusals above | pass | Before and after: status Submitted, `reviewerComment` null, `updatedAt` 2026-09-15T09:20:00Z, `decidedByName`/`decidedAt` null |
| AR-01: Priya approves 101 | pass | 200, status Approved, `decidedByName` "Priya Menon", `decidedAt` = `updatedAt` = 2026-10-31T09:29:22.689Z |
| AR-02: Priya rejects 103 with "Please add the cost centre." | pass | 200, status Rejected, `reviewerComment` saved, `decidedByName` "Priya Menon" |
| AR-55 (API part): seeded 102 and 104 have no recorded decision | pass | `decidedByName` and `decidedAt` null for both |

**Browser walkthrough and review tools**

| Command or scenario | Result | Evidence |
| --- | --- | --- |
| Browser walkthrough AR-50 to AR-56 (controls, Decided by/on, Not recorded, banner on refusal, refresh after a decision) | not run | Needs a person to look at the screen. A fresh throwaway server for this is running on http://localhost:3102 (built UI). |
| `authorization-reviewer` on the changed files | pass (no blocker or major) | Ran 2026-10-31 on the plan.md file list (diff approximated; not a git repo). 0 blocker, 0 major, 3 minor (doc mismatches), listed under Findings. Rules 1–4 checked: identity via `getCurrentUser`; check order id → 404 (missing or can't view) → 403 → 409 → 400 before the transaction; existing codes and messages; `?` placeholders only. |
| `npm test` / `lint` / `build` after fixing findings 1–3 | pass | Exit 0. Server 61/61, client 19/19. |
| `/verify-checkpoint training/work/approve-or-reject` | PASS (recommendation) | Invoked by the user on 2026-10-31. test exit 0 (server 61/61, client 19/19); lint exit 0; build exit 0. Its `authorization-reviewer` run found no authorization findings. All 29 spec IDs are mapped, and every automated row is evidenced by a passing test. The browser parts of AR-50, AR-53, AR-54 and AR-55 were MANUAL — UNVERIFIED. |

## Findings

From `authorization-reviewer`, 2026-10-31. All three are minor doc defects in this change's diff. Under `constitution.md` W5 they were fixed in the diff, not routed back.

1. **minor, `docs/architecture.md` §5:** the client-button bullet listed only the old conditions. **Resolution:** rewritten to list the cancel conditions and all four approve/reject conditions, as UX only.
2. **minor, `docs/architecture.md` §5:** the cancel bullet cited `cancelRequest, 103` (now `rejectRequest`). **Resolution:** changed to 128.
3. **minor, `docs/architecture.md` §3.2:** "Each mutation runs a single `UPDATE`" contradicted the transaction. **Resolution:** now says cancel runs one `UPDATE`, and approve/reject run an `UPDATE` plus an `INSERT` in one transaction.

Reviewer notes, not findings:
- **Agent instructions looked stale.** The reviewer said its instructions still listed the old "decide checks ownership, not role" gap, and marked this "unverified". The file *was* updated in checkpoint 5: `.claude/agents/authorization-reviewer.md` lines 63 and 103 were confirmed after the run. The running agent likely loaded its definition when the session started.
- **Out of scope:** `CLAUDE.md` working notes still say the approve/reject test fixtures are 201–202; they are now 201–205. This is not fixed in this change: `CLAUDE.md` isn't in the plan's file list. It's left for the reviewer to decide.

## Decision
**Accepted** by Sagar Sharma (technical reviewer), 2026-10-31.

At acceptance, the browser walkthrough (AR-50 to AR-56) was still recorded as **not run**: no screen observation is recorded here. The reviewer accepted on the basis of:
- the automated tests
- the API walkthrough
- two `authorization-reviewer` runs with no blocker or major findings
- the `verify-checkpoint` PASS recommendation

Out-of-scope notes carried forward, not fixed by this change:
- `.claude/agents/authorization-reviewer.md` lines 22, 42 and 50 refer to `CLAUDE.md` sections *Simulated identity* and *Server layering*, which no longer exist under those names. The content is now in "Working notes → Server modules". This was reported by the second `authorization-reviewer` run.

Do not treat an agent's self-assessment as independent approval. Do not mark unexecuted checks as passing.
