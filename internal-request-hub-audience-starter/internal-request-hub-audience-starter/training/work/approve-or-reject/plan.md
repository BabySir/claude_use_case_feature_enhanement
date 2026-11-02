# Implementation plan: Approve or reject an assigned request

Intent: training/work/approve-or-reject/intent.md (accepted 2026-10-31, product owner Sagar Sharma)
Specification: training/work/approve-or-reject/spec.md (accepted 2026-10-31, technical lead Sagar Sharma; Q1 and Q3–Q12 decided)
Engineer (owner): Sagar Sharma — drafted with Claude Code
Reviewer (approver): Technical reviewer — Sagar Sharma
State: accepted

## Repository evidence

### Observed (read in the code, 31 Oct 2026)

**Server: request rules**

- `server/src/requests.js` → `getVisibleRequest` (34) checks, in order:
  - the id is an integer (400 `INVALID_REQUEST_ID`)
  - the row exists (404 `REQUEST_NOT_FOUND`)
  - the view rule, computed inline as `allowed` (45): admin, the requester when an employee, or the assigned reviewer when a reviewer. If it fails: 403 `REQUEST_FORBIDDEN` "You cannot view this request." (49).
  - `server/src/comments.js` reuses `getVisibleRequest` and must keep its current behavior.
- `loadDecidableRequest` (56) **does not** use the view rule. It checks:
  - id format and existence
  - `assignedReviewerId !== user.id` → 403 "You cannot decide this request." (67)
  - status not Submitted → 409 `REQUEST_NOT_DECIDABLE` (71)

  It has no role check and no requester check.
- `approveRequest` (78) and `rejectRequest` (87) each run **one** `UPDATE` (82, 97) without a transaction, then re-read through `requestSelect` (3). `rejectRequest` trims and requires the comment before writing.
- `requestSelect` (3–23) joins `categories`, the requester and the optional reviewer (`LEFT JOIN users reviewer`, 22). It has no decision fields.
- `cancelRequest` (103) and `visibilityClause` (128) are out of scope and stay unchanged.

**Server: database**

- `server/src/db.js` → `migrate` (22) uses `CREATE TABLE IF NOT EXISTS` only. `request_comments` (55) is the precedent for adding a table without a reset.
- A `transaction(db, operation)` helper exists (114), but it's private to `db.js`: only `createDatabase` and `defaultDatabasePath` are exported.

**Server tests**

- `server/test/app.test.js`:
  - The approve/reject block (154) inserts fixtures 201 (Submitted, Maya → Priya) and 202 (Draft, Maya → Priya) in its `before` (169, 173).
  - The first test, "denies a reviewer who isn't assigned to the request from approving it" (179), has Daniel approve 103 and expects **403 `REQUEST_FORBIDDEN`**.
  - The block also covers:
    - requester approve on 103 (403)
    - admin reject on 103 (403)
    - empty or `undefined` reject comment (400)
    - Priya rejects 103 with a trimmed comment
    - Priya approves 201
    - 409 for 103 after rejection, for 102, 104, cancelled 101 and draft 202
    - 404 for 999
  - The comments block (293) runs last and later approves fixture 302 (Maya → Priya), so it will create a decision row.
- All refusals snapshot `SELECT * FROM requests`.

**Client**

- `client/src/components/RequestDetails.jsx`:
  - The decision controls render when `status === "Submitted" && assignedReviewerId === currentUserId` (74).
  - The details grid has six `Detail` rows (53–58) using `formatDate`.
- `client/src/App.jsx` already has `currentUser`, with its role (25), and renders `<RequestDetails …>` (142).
- `client/src/components/RequestDetails.test.jsx`: the AC-10 tests (52, 58, 65) render with `currentUserId={3}` and **no role prop**. The AC-11 tests (81, 87) assert the controls are hidden. `App.test.jsx` has no decision test.

**Local environment**

- The developer's local `server/data/request-hub.db` has no Submitted requests left: 101 and 103 are Cancelled. This was observed on 31 Oct 2026, during the comments walkthrough.

### Assumptions (not verified by running)

- An existing local DB gains `request_decisions` on the next start (same mechanism as `request_comments`, `docs/architecture.md` §6).
- Adding two `LEFT JOIN`s on a primary key keeps one row per request in list responses. `request_decisions.request_id` is the primary key, so this holds by construction.

## Approach and tradeoffs

**Chosen approach:** the spec's design, applied in the fewest files.

1. **Data:**
   - Add the `request_decisions` table in `migrate`.
   - **Export the existing `transaction` helper** from `db.js` and reuse it, rather than writing a second `BEGIN`/`COMMIT` block.
2. **Rules** (`requests.js`):
   - Extract `canViewRequest(user, request)` from `getVisibleRequest`. `getVisibleRequest` calls it and is otherwise unchanged.
   - Rewrite `loadDecidableRequest` to:
     1. check the id format (400)
     2. check existence, and return the same 404 when the user can't view the request
     3. require the assigned reviewer **and** the reviewer role **and** not the requester (403)
     4. check the status (409)
   - `approveRequest` and `rejectRequest` run the `UPDATE` plus `INSERT INTO request_decisions` inside `transaction(...)`, with one `now` value.
   - Extend `requestSelect` with `LEFT JOIN request_decisions d` and `LEFT JOIN users decider`, returning `decidedById`, `decidedByName` and `decidedAt`.
3. **Routes:** no changes.
4. **Client:**
   - `App.jsx` passes `currentUserRole`.
   - `RequestDetails.jsx` adds two conditions to the decision-controls check, plus "Decided by" and "Decided on" rows for Approved or Rejected requests, showing "Not recorded" when null.
5. **Docs and tooling:** update `docs/domain.md`, `docs/architecture.md`, and the known-gap line in `.claude/agents/authorization-reviewer.md`.
6. **Review record:** write the walkthrough results and review results to `training/work/approve-or-reject/review.md`, from the `review.md` template. That way the manual evidence exists as a record `verify-checkpoint` can cite.

**Tradeoffs considered**

- **Export `transaction`, or inline `BEGIN`/`COMMIT` in `requests.js`?** Export it: it reuses the existing helper with a one-word change. Inlining would duplicate the rollback logic.
- **Where the 404 for non-viewers comes from.**
  - `loadDecidableRequest` can't call `getVisibleRequest`, because that throws **403** "You cannot view this request.", and R8 needs 404 "Request not found." when deciding.
  - Extracting `canViewRequest` lets both use one view rule without changing `getVisibleRequest`'s behavior for viewing and comments (spec Q12).
- **Decision-control conditions in the client, or a single `canDecide` flag from the server?**
  - Use client conditions, matching the existing pattern for Cancel and decide.
  - A server-computed flag would be a new response-shape concept beyond the spec.
- **An employee who is the assigned reviewer but can view the request.**
  - An employee can view only requests they raised. That case is therefore always also self-decision (R3), so no separate employee-and-can-view fixture is needed.
  - AR-17 shows the employee-assigned case returns 404, and AR-16 isolates the role rule using the admin.

## Ordered checkpoints

Each checkpoint ends with `npm test`, `npm run lint` and `npm run build`, with the real results reported. Stop at any failure.

1. **Schema and helper**: `server/src/db.js`
   - Add `CREATE TABLE IF NOT EXISTS request_decisions (request_id INTEGER PRIMARY KEY REFERENCES requests(id), decided_by_id INTEGER NOT NULL REFERENCES users(id), decided_at TEXT NOT NULL)` to `migrate`.
   - Export `transaction`. No seed change.
   - **Verify:**
     - The existing tests pass unchanged: 45 server, 14 client.
     - If `npm run dev` is running, its `--watch` restart creates the table in the local DB. Confirm with a read-only `node:sqlite` query on `sqlite_master`.

2. **Server rules and domain tests**: `server/src/requests.js`, `server/test/app.test.js`
   - Implement the approach's step 2 exactly as above.
   - **Tests in the approve/reject block:**
     - Change the test at line 179 to expect **404 `REQUEST_NOT_FOUND`** (AR-10, an approved behavior change, Q5). Keep its snapshot assertion.
     - Add fixtures to its `before`, all Submitted:
       - **203**: Rahul → Alex (admin)
       - **204**: Rahul → Maya (employee)
       - **205**: Priya → Priya (raised by a reviewer, assigned to herself)
     - Add tests for AR-11, AR-12 (reject), AR-13, AR-14, AR-15 (approve), AR-16, AR-17, AR-18, AR-31 ("abc") and AR-40 to AR-42.
     - Extend AR-30 with `""`.
     - Every refusal snapshots the `requests` row **and** `SELECT * FROM request_decisions WHERE request_id = ?`.
     - Extend the existing success tests:
       - Priya approves 201 (stands in for AR-01, because 101 is Cancelled by then): assert `decidedById` 3, `decidedByName` "Priya Menon" and a parseable `decidedAt` equal to `updatedAt`, plus a decision row.
       - Priya rejects 103 (AR-02/03): assert the same.
   - **Test order:** 101 is already Cancelled by the cancel block, so the AR-10/11/13/14/15/40 tests that need "can view vs. can't" use **103** (Submitted until the reject-success test) or **201**, placed before the success tests.
   - **Verify:** `cd server && node --test --test-name-pattern="approve/reject" test/app.test.js`, then `npm test`, lint and build.

3. **HTTP tests**: new `server/test/decisions-http.test.js` (no route changes)
   - Use the `comments-http.test.js` pattern: own `createDatabase(":memory:")`, `listen(0)`, `fetch`, and close in `after`. Insert fixtures 203 and 205 directly.
   - **Assert:**
     - 200 + Approved + `decidedByName` (AR-01 on 101, fresh DB)
     - 200 + Rejected + comment (AR-02 on 103)
     - 404 for Daniel on a Submitted request (AR-10)
     - 403 for Maya on her own request (AR-12) and for Alex on 203 (AR-16)
     - 409 on 102 (AR-20)
     - 400 for an empty comment (AR-30)
     - 404 on 999 and 400 on "abc" (AR-31)
     - 400 and 401 for no or inactive user (AR-32)
     - the exact `{ error: { code, message } }` bodies
   - **Verify:** `npm test` (the new file is discovered automatically), lint and build.

4. **Client**: `client/src/App.jsx`, `client/src/components/RequestDetails.jsx`, the client tests
   - `App.jsx`: pass `currentUserRole={currentUser?.role}` to `RequestDetails`.
   - `RequestDetails.jsx`:
     - Accept `currentUserRole`.
     - The decision controls require `status === "Submitted"`, `assignedReviewerId === currentUserId`, `currentUserRole === "reviewer"` and `requesterId !== currentUserId`.
     - For Approved or Rejected requests, add `<Detail label="Decided by" value={request.decidedByName ?? "Not recorded"} />` and `<Detail label="Decided on" value={request.decidedAt ? formatDate(request.decidedAt) : "Not recorded"} />`.
   - **Tests** in `RequestDetails.test.jsx`:
     - Add `currentUserRole="reviewer"` to the AC-10 tests.
     - New tests:
       - AR-52: controls hidden for an assigned non-reviewer, and for the assigned reviewer who is the requester
       - AR-53: "Decided by Priya Menon" and the date shown when the decided fields are present
       - AR-55: "Not recorded" for Approved or Rejected with null fields
       - AR-56: no decided rows for Submitted, Draft or Cancelled
   - **Verify:** `cd client && npx vitest run`, then `npm test`, lint and build.

5. **Docs and tooling**: `docs/domain.md`, `docs/architecture.md`, `.claude/agents/authorization-reviewer.md`
   - `domain.md`:
     - §2 and §6: the reviewer role and no self-decision. Remove the two resolved open questions.
     - §4: "Decided by" and "Decided on", with "Not recorded" for older decisions.
     - §7: deciding a request you can't view gives "Request not found."
   - `architecture.md`:
     - §3.2 and §5: `canViewRequest`, the new decide check order, and the decision transaction.
     - §6: `request_decisions`.
     - §8: the new HTTP test file and counts.
     - Update cited line numbers.
   - `authorization-reviewer.md`:
     - The known-gap line becomes "Cancel checks ownership, not role".
     - Rule 2's decide bullet adds the role and requester checks.
     - The documented check order for decide becomes id → existence/view (404) → permission (403) → status (409) → comment (400).
   - **Verify:** review the diff for these files, then `npm test`, lint and build.

6. **Manual walkthrough and review record**: a throwaway database
   - Start a temporary API on its own port with `DB_FILE` in the scratchpad, the same way as the comments walkthrough. Rebuild `client/dist` first, so its built UI is current.
     - Stop any earlier temporary server first.
     - **Don't** use or reset the developer's local DB.
   - **Through the API:** check AR-01, AR-02, AR-10, AR-12, AR-14 and AR-40 to AR-42.
   - **In the browser:**
     - AR-50 to AR-56 as Priya, Daniel, Maya and Alex: the controls, "Decided by" and "Decided on", "Not recorded" on 102 and 104, the banner on refusal, and refresh after a decision.
     - Screen observations are recorded only if a person actually looked.
   - Write `training/work/approve-or-reject/review.md` from the `review.md` template:
     - every command or scenario actually run, with its real result
     - "not run" for anything skipped
     - the reviewer decision left for the technical reviewer
   - Then run W4 review:
     - `use authorization-reviewer on <changed files>`
     - `/verify-checkpoint training/work/approve-or-reject`
   - Add their results to `review.md`.

## Acceptance-to-evidence map

| Acceptance example | Checkpoint | Automated check or manual observation |
| --- | --- | --- |
| AR-01 assigned reviewer approves | 2, 3, 6 | Domain: Priya approves 201, giving Approved, `decidedById` 3, `decidedAt` = `updatedAt`, and a decision row. HTTP: 200 on 101 with `decidedByName`. Walkthrough via API. |
| AR-02 assigned reviewer rejects with comment | 2, 3, 6 | Domain: Priya rejects 103, giving Rejected, the comment saved, and a decision row. HTTP: 200. Walkthrough via API. |
| AR-03 comment trimmed | 2 | Domain: the existing reject test's "  Needs more detail.  " is saved as "Needs more detail.". |
| AR-10 unrelated reviewer approves, gets 404 | 2, 3, 6 | Domain: the changed test at line 179, Daniel on 103, expects 404 `REQUEST_NOT_FOUND` with both snapshots unchanged. HTTP: 404 body. |
| AR-11 unrelated reviewer rejects, gets 404 | 2 | Domain: Daniel rejects 103 with a comment, giving 404 with snapshots unchanged. |
| AR-12 requester decides own, gets 403 | 2, 3, 6 | Domain: the existing requester-approve test (Rahul on 103) plus a new reject case, giving 403 with snapshots unchanged. HTTP: Maya on her own Submitted request gives 403. |
| AR-13 non-requester employee, gets 404 | 2 | Domain: Maya approves and rejects 103 (Rahul's), giving 404 with snapshots unchanged. |
| AR-14 admin approves, gets 403 | 2, 6 | Domain: Alex approves 103, giving 403 with snapshots unchanged. Walkthrough via API. |
| AR-15 admin rejects, gets 403 | 2 | Domain: the existing admin-reject test on 103, giving 403 with snapshots unchanged. |
| AR-16 assigned admin, gets 403 (role) | 2, 3 | Domain: Alex approves and rejects fixture 203, giving 403 with snapshots unchanged. HTTP: 403 body. |
| AR-17 assigned employee who can't view, gets 404 | 2 | Domain: Maya approves fixture 204, giving 404 with snapshots unchanged. |
| AR-18 reviewer self-decision, gets 403 | 2, 3 | Domain: Priya approves and rejects fixture 205, giving 403 with snapshots unchanged. HTTP: 403 body. |
| AR-20 approve an Approved request, gets 409 | 2, 3 | Domain: the existing Daniel-approves-102 test, with snapshots extended to decisions. HTTP: 409 body. |
| AR-21 reject a Rejected request, gets 409 | 2 | Domain: the existing Daniel-rejects-104 test, with snapshots extended. |
| AR-22 decide a Cancelled request, gets 409 | 2 | Domain: the existing Priya-approves-cancelled-101 test, with snapshots extended. |
| AR-23 decide a Draft, gets 409 | 2 | Domain: the existing Priya-approves-draft-202 test, with snapshots extended. |
| AR-30 empty, blank or missing comment, gets 400 | 2, 3 | Domain: the existing `"   "` and `undefined` cases, plus a new `""` case, with snapshots unchanged. HTTP: 400 `REJECTION_COMMENT_REQUIRED` body. |
| AR-31 999 gets 404, "abc" gets 400 | 2, 3 | Domain: the existing 999 test, plus a new "abc" case. HTTP: both bodies. |
| AR-32 no or inactive user, gets 400 or 401 | 3 | HTTP: approve and reject without `currentUserId` give 400 `CURRENT_USER_REQUIRED`; user 6 gives 401 `INVALID_CURRENT_USER`; the row is unchanged afterwards (checked with a GET as admin). |
| AR-40 non-viewer on an Approved request, gets 404, not 409 | 2, 6 | Domain: Priya approves 102, giving 404 with snapshots unchanged. Walkthrough via API. |
| AR-41 admin on an Approved request, gets 403, not 409 | 2, 6 | Domain: Alex approves 102, giving 403. Walkthrough via API. |
| AR-42 admin with an empty comment, gets 403, not 400 | 2, 6 | Domain: Alex rejects 103 with "", giving 403. Walkthrough via API. |
| AR-50 controls shown to the assigned reviewer | 4, 6 | `RequestDetails.test.jsx`: the AC-10 tests with `currentUserRole="reviewer"`. Walkthrough in the browser, recorded in `review.md`. |
| AR-51 controls hidden for others or non-Submitted | 4 | `RequestDetails.test.jsx`: the existing AC-11 tests, still passing. |
| AR-52 controls hidden for a non-reviewer or the requester | 4 | `RequestDetails.test.jsx`: new tests with `currentUserRole="employee"` / `"admin"` when assigned, and the requester equal to the assigned reviewer. |
| AR-53 status refresh plus "Decided by"/"Decided on" | 4, 6 | `RequestDetails.test.jsx`: decided fields render "Priya Menon" and a formatted date. Refresh without reload: walkthrough in the browser, recorded in `review.md`. |
| AR-54 refusal message in the banner | 6 | Walkthrough in the browser, recorded in `review.md`. This is existing banner behavior; the server messages themselves are covered by AR-10 to AR-42. |
| AR-55 "Not recorded" for earlier decisions | 4, 6 | `RequestDetails.test.jsx`: Approved with null decided fields shows "Not recorded". Walkthrough on 102 and 104. |
| AR-56 no decided rows when not decided | 4 | `RequestDetails.test.jsx`: Submitted, Draft and Cancelled render no "Decided by" row. |

## Risks and recovery

**Authorization**

- **Two view rules drifting apart.**
  - *Mitigation:* `canViewRequest` becomes the only JavaScript copy, used by both `getVisibleRequest` and `loadDecidableRequest`. The SQL `visibilityClause` is still separate, as documented.
  - *Recovery:* if a domain test shows view/decide disagreement, fix it in `canViewRequest` only.
- **Order-of-checks regression**, for example the status message leaking to a non-viewer. *Mitigation:* AR-40 to AR-42 assert the exact code at each boundary.
- **Changing `getVisibleRequest` by accident** would change viewing and comments (Q12 says no). *Mitigation:* the existing view tests and all 17 comment tests must still pass unchanged.

**State and test isolation**

- The decide tests run on the shared DB, where 101 is Cancelled and 103 is Rejected partway through.
  - *Mitigation:* new denials target 103 or 201 **before** the success tests, or the new fixtures 203–205.
  - *Recovery:* if ordering breaks an existing test, move the new denials into their own `describe` with its own in-memory DB.
- The comments block approves fixture 302 later, creating a decision row. No comments test asserts on decisions, so no impact is expected.

**Persistence**

- The additive table means existing local DBs upgrade on start.
- A rollback of the code leaves an unused table, which is harmless.
- `transaction` guarantees the status and the decision are saved together.
- Seeded or earlier decisions have no row, and show "Not recorded" (Q11).

**Integration**

- *Response shape:* every request response gains three nullable fields. The client and tests that build request objects by hand don't need them, because missing fields read as `undefined` and are treated like null.
- *Client tests:* AC-10 tests break until they pass `currentUserRole`. That is expected, and fixed in the same checkpoint.
- *Walkthrough environment:* the developer's local DB has no Submitted requests, so checkpoint 6 uses a throwaway DB on its own port and never resets local data. An earlier temporary server from the comments walkthrough may still be running on port 3101 with old code. Stop it before starting a new one.

**Docs and tooling drift**

- If checkpoint 5 is skipped, `docs/domain.md` §6 and the authorization-reviewer's known gaps would describe the old assignment-only rule.
- The reviewer agent would then accept the new behavior while describing it wrongly.
- Keep checkpoint 5 in the same change.

### Open questions for the reviewer

Each has the engineer's recommendation. The reviewer confirms or overrides each one when deciding on the plan.

1. **Export `transaction` from `db.js`?**
   - **Recommendation: yes.** It reuses the existing helper; the alternative duplicates rollback logic in `requests.js`.
2. **`review.md` as the record of manual evidence and review results** (checkpoint 6)?
   - **Recommendation: yes.** The template exists for this, and it lets `verify-checkpoint` report manual rows as `MANUAL — RECORDED` instead of unverified. The comments feature lacked this.
3. **Walkthrough on a throwaway DB** rather than `npm run db:reset`?
   - **Recommendation: throwaway DB.** It keeps the developer's local data, and it worked for comments.
4. **"Decided on" format:** date only, with the existing `formatDate`, as the spec says "existing date format"?
   - **Recommendation: date only.** Comments show date and time, so flag it if the time is wanted for accountability.

## Approval record
Decision: accepted — the reviewer explicitly confirmed open question 2 (record manual evidence and review results in review.md). Open questions 1, 3 and 4 were not answered individually; they stand at their recommendations (export `transaction`; throwaway DB for the walkthrough; "Decided on" as date only) as part of accepting the plan.
Approver (reviewer): Technical reviewer — Sagar Sharma
Date: 2026-10-31
Do not begin implementation while pending.

## Findings routed back here
None yet.
