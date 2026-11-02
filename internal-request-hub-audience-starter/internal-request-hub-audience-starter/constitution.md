# Internal Request Hub — Team Constitution

**State:** Revision 2, accepted 31 Oct 2026 (Sagar Sharma). See the approval record at the end.
**Context:** [`docs/domain.md`](docs/domain.md) (business rules) and [`docs/architecture.md`](docs/architecture.md) (how the code implements them). Both are accepted, and were updated on 31 Oct 2026 for request comments and for approve/reject decisions.

## Status

- **Implemented so far:** **request comments** (GitHub issue #5), implemented and reviewed in this session.
  - The artifacts are in `training/work/add-comment/`: `intent.md`, `spec.md` and `plan.md`, each with a recorded approval.
  - All six plan checkpoints passed test, lint and build.
  - The `authorization-reviewer` agent found no blocker or major issues, and `verify-checkpoint` recommended PASS.
  - The artifacts were written **before** this convention existed, and don't fully conform to it: there's no distinct technical lead or technical reviewer, and no `review.md`.
- **Implemented under this convention:** **approval/rejection** (GitHub issue #2), in `training/work/approve-or-reject/`. It is the first feature to follow the convention end to end.
  - **Artifacts:** `intent.md` (product owner), `spec.md` (technical lead), `plan.md` (technical reviewer) and `review.md` (technical reviewer) were all accepted on 31 Oct 2026.
  - **What the review was based on:**
    - all six checkpoints passed test, lint and build
    - two `authorization-reviewer` runs found no blocker or major issues
    - `verify-checkpoint` recommended PASS
    - an API walkthrough
  - **Not observed:** the browser walkthrough (AR-50 to AR-56) was recorded as not run when the review was accepted.
- **Open, as later exercises:** **cancellation**, **reviewer reassignment** and **request history**. Cancellation already exists in today's code (`docs/domain.md` §6), so that exercise needs its scope stated against existing behavior. Reassignment and history don't exist (`docs/domain.md` §8).

---

## Part A — Existing facts (not rules; they describe the repository today)

These are taken from the accepted docs. They change only when the code changes and the docs are updated with it.

| # | Fact | Source |
|---|---|---|
| F1 | The stack is plain JavaScript: React 19 + Vite for the client, Express 5 for the API, and SQLite through Node's built-in `node:sqlite`. npm workspaces (`client/`, `server/`). No TypeScript, no ORM. | `docs/architecture.md` §1–2 |
| F2 | Routes in `server/src/app.js` are thin: resolve the user, call a domain function, return `{ data }`. Rules and SQL live in focused modules (`requests.js`, `comments.js`). | `docs/architecture.md` §4 |
| F3 | Identity is **simulated**: the client sends `currentUserId` as a query parameter, `getCurrentUser` resolves it, and the server trusts it. There is no real sign-in. | `docs/domain.md` §3; `docs/architecture.md` §5 |
| F4 | Access and state rules are enforced on the server. Hiding a button in the client is UX only. | `docs/architecture.md` §5 |
| F5 | Visibility: employees see their own requests, reviewers see the requests assigned to them, administrators see all. Comments follow the single-request view rule. Only the assigned reviewer, with the reviewer role and not the requester, can approve or reject. | `docs/domain.md` §4–6 |
| F6 | Errors use one shape, `{ error: { code, message } }`, produced from `HttpError` by the error middleware, with a fixed set of codes and messages. | `docs/architecture.md` §3, §5; `docs/domain.md` §7 |
| F7 | SQL uses `db.prepare(...)` with `?` placeholders and bound values. | `docs/architecture.md` §3.1 |
| F8 | Verification commands are `npm test`, `npm run lint` and `npm run build`. CI runs the same three. | `docs/architecture.md` §8 |
| F9 | There are no notifications, external services or real authentication. | `docs/domain.md` §8 |

---

## Part B — Team rules (proposed)

These are agreements about how we work, not descriptions of the code. **None of them is enforced by tooling.** They hold because reviewers check them. The tools named below help a reviewer, but they don't block anything automatically.

### Engineering rules

- **R1 — Stack.** Keep the existing JavaScript, React, Express and SQLite stack (F1). Don't introduce TypeScript, an ORM, or another framework or database as part of a feature.
- **R2 — Layering.** Keep HTTP handlers thin, and keep database behavior in focused modules (F2). Routes resolve identity, call a domain function, and shape the response.
- **R3 — Safety.** Use parameterized SQL only (F7). Enforce access and state rules on the server (F4). Client-side hiding is never the enforcement.
- **R4 — Compatibility.** Preserve the existing API error shape and codes (F6) and the existing visibility behavior (F5), unless an accepted spec explicitly changes them.
- **R5 — Scope.** Keep each change within its assigned exercise. Work outside it, including small unrelated fixes, needs its own decision and record.
- **R6 — Acceptance evidence.** Map every acceptance example to a verification method, **including denied actions**: who is refused, and what stays unchanged.
- **R7 — Done means checked.** Before a change is complete, run `npm test`, `npm run lint` and `npm run build`, and inspect the diff. Report the real results.
- **R8 — Recorded decisions.** Record who reviews each change and who approves any exception. Never invent, assume or backfill an approval.
- **R9 — Exercise boundaries.** Keep the simulated identity (F3). Real authentication, notifications and external services are not part of this exercise (F9).

### Spec-driven workflow rules

These replace a single "agree intent and specification" rule.

- **W1 — One folder per feature.**
  - Each feature gets its own folder, `training/work/<feature-name>/`.
  - `<feature-name>` is a short kebab-case name. When the feature comes from a GitHub issue, it is taken from the issue's title, without the "Feature:" prefix. For example, issue #2 "Approve or reject an assigned request" becomes `approve-or-reject`, and issue #5 "Add a comment to a request" becomes `add-comment`.
  - The folder holds three artifacts, created in strict order: `intent.md`, then `spec.md`, then `plan.md`.
  - `training/work/` is the single home for all feature work in this repo. There is no separate `specs/` folder.
  - The convention is described in `training/work/README.md`.
  - New artifacts start from the blank templates in `training/work/_templates/`.
- **W2 — Owners and approvers.**

  | Artifact | Records | Drafted / owned by | Approved by |
  |---|---|---|---|
  | `intent.md` | Problem, outcome and scope | Originator | Product owner |
  | `spec.md` | Behavior, design and constraints | Engineer | Technical lead |
  | `plan.md` | Implementation steps and checks | Engineer | Technical reviewer |

  - **From a GitHub issue:** the originator may use the `draft-intent-from-issue` skill to fetch the issue and produce a draft `intent.md`. Its output is always a **draft**. It must not mark the intent accepted, and the issue link must be recorded in `intent.md` as its source.
  - **Using `plan-feature`:** once `spec.md` is accepted, the engineer may draft `plan.md` with the forthcoming `plan-feature` skill instead of by hand. The output and the approval requirement are identical either way.
- **W3 — Gate rule.**
  - An artifact is drafted only after the previous phase's artifact, **in the same folder**, has been explicitly approved by its named approver.
  - Don't draft the next phase's artifact early, and don't invent or assume an approval that wasn't actually given.
- **W4 — Implementation and review.**
  - Once `plan.md` is approved, implementation produces a diff, and that diff is reviewed.
  - Every diff gets an **authorization review** with the `authorization-reviewer` agent.
  - Once `plan.md` has an Acceptance-to-evidence map, every diff also gets a **verification check** against it with the `verify-checkpoint` skill.
  - These replace an ad hoc read-through. How to invoke them is documented in `CLAUDE.md`.
  - `/code-review` and `/security-review` remain available for concerns outside the authorization boundary.
- **W5 — Findings go back, not forward.** A review finding returns to the earlier decision that needs correcting:

  | Finding | Returns to |
  |---|---|
  | A defect in the implementation | The diff, for a fix |
  | An unsuitable approach | `plan.md`, for revision |
  | Unclear or unsuitable behavior | `spec.md`, for clarification |

  Record which stage each finding was routed back to, in that artifact's "Findings routed back here" section, or in the diff's review record for implementation defects.
- **W6 — Approvals are recorded in the artifact.**
  - Record the actual decision, approver and date for every phase transition inside the artifact itself, or in a short note beside it.
  - An agent never marks a phase approved on its own authority. It records only an approval a named person actually gave.
- **W7 — Records carry decisions between sessions.**
  - The saved artifacts are the source of truth for what was decided.
  - Don't reconstruct a decision by replaying earlier chat history; read the artifact.
  - If the artifact doesn't record a decision, the decision hasn't been made.

---

## Approval record

### Revision 2
Decision: accepted
Approvers: Sagar Sharma (sagar.sharma@trenser.com)
Date: 2026-10-31
Changes from revision 1:
- **Status:** brought up to date. Comments are reviewed; approval/rejection is implemented and awaiting review.
- **F5:** now states the approve/reject rule.
- **W1:**
  - The placeholder is now `<feature-name>`.
  - Templates now come from `training/work/_templates/`, in place of `Training1/_templates/_templates/`.
  - The comments artifacts moved to `training/work/add-comment/`.
- **W5:** says where implementation-defect findings are recorded.

Status update, 2026-10-31, requested by Sagar Sharma: approval/rejection moved from "In progress" to implemented, after `review.md` was accepted. This updates the Status section only; no rule, fact or workflow changed.

### Revision 1
Decision: accepted
Approvers: Sagar Sharma (sagar.sharma@trenser.com)
Date: 2026-10-31
Notes: Accepted as drafted. Open items carried forward, not resolved by this acceptance: (1) the feature-folder layout under training/add-comment/ vs. the comments artifacts sitting at its root; (2) spec.md and plan.md templates still label the approver "Reviewer" rather than technical lead / technical reviewer; (3) training/add-comment/{intent,spec,plan}.md do not yet conform (see W2); (4) scope of the approval/rejection and cancellation exercises against existing behavior; (5) proposed CLAUDE.md pointers not yet applied.
Amendment 2026-10-31 (Sagar Sharma): W1 changed. Feature folders are now `training/work/<feature>/`, named from the issue title, and the convention README moved to `training/work/README.md`. This resolves carried-forward item (1) for new features. The existing comments artifacts in `training/add-comment/` haven't been moved. *(They have since been moved to `training/work/add-comment/`, in revision 2.)*
