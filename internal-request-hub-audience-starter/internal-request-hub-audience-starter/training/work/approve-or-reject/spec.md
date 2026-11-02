# Specification: Approve or reject an assigned request

Intent: training/work/approve-or-reject/intent.md (accepted 2026-10-31 by Sagar Sharma, product owner; product owner decisions on Q2 and Q9 recorded 2026-10-31)
Engineer (drafter): Sagar Sharma — drafted with Claude Code
Reviewer (approver): Technical lead — Sagar Sharma
State: accepted

## Behavior and acceptance examples

### Confirmed rules

These come from GitHub issue #2, the accepted intent and the product owner's decisions of 2026-10-31. They are not open in this spec.

- **R1:** Only the request's **assigned reviewer** may approve or reject it.
- **R2 (Q2):** the decider must also have the **reviewer role**. An employee or administrator can never decide a request, even if recorded as its assigned reviewer.
- **R3 (Q3):** a user can **never decide a request they raised**, even if they are its assigned reviewer and have the reviewer role.
- **R4:** The request must be **Submitted**. Any other status can't be decided, and a decided request can't be decided again.
- **R5:** Rejecting requires a non-empty reviewer comment. Surrounding whitespace is removed before saving; this is current behavior and is kept.
- **R6:** A successful decision persists the new status.
- **R7 (Q7):** A successful decision also records **who decided and when**. The request's detail page shows "Decided by" and "Decided on" for decided requests.
- **R8 (Q5):** A user who **can't view** a request is told **"Request not found."** when they try to approve or reject it, so the attempt doesn't reveal that the request exists. A user who can view the request but isn't allowed to decide it is told "You cannot decide this request."
- **R9 (Q4):** All other refusal messages stay as they are today.
- **R10:** A failed decision changes nothing that is stored: the request and its decision record stay as they were.
- **R11:** Out of scope:
  - from the issue: reviewer reassignment, multi-level approvals, notifications, and reopening a decided request
  - from product owner decisions: an approval comment (Q6, ignored) and assigning to inactive users (Q8)

### Examples

These use the seed data:

- **Users:** 1 Maya (employee), 2 Rahul (employee), 3 Priya (reviewer), 4 Daniel (reviewer), 5 Alex (admin), 6 Former Reviewer (inactive).
- **Requests:**
  - 101: Submitted, Maya → Priya
  - 102: Approved, Maya → Daniel
  - 103: Submitted, Rahul → Priya
  - 104: Rejected, Rahul → Daniel, with a reviewer comment
  - 105: Draft, Maya, no reviewer

"Refused" means the user sees the stated message, and both the request's stored row and its decision record are unchanged.

**Successful decisions (R1, R5, R6, R7)**

| ID | Given | When | Then |
|---|---|---|---|
| AR-01 | 101 is Submitted, assigned to Priya | Priya approves 101 | 101 is Approved, and "Last updated" changes. The reviewer comment stays empty. The decision is recorded as Priya at the time of approval. A fresh read returns all of this. |
| AR-02 | 103 is Submitted, assigned to Priya | Priya rejects 103 with "Please add the cost centre." | 103 is Rejected, the reviewer comment is saved, and the decision is recorded as Priya at the time of rejection. A fresh read returns all of this. |
| AR-03 | A Submitted request assigned to Priya | Priya rejects with "  Needs more detail.  " | The saved comment is "Needs more detail." |

**Refused: can't view the request (R8, new behavior)**

Each of these is refused with "Request not found." and nothing changes.

| ID | Given | When |
|---|---|---|
| AR-10 | Daniel is a reviewer not assigned to 101 | Daniel **approves** 101 |
| AR-11 | Same | Daniel **rejects** 101 with a comment |
| AR-13 | Rahul is an employee who didn't raise 101 | Rahul approves 101, and Rahul rejects 101 |
| AR-17 | A Submitted request raised by Rahul, with **Maya (employee)** as its assigned reviewer (test-only fixture). Maya can't view it, because employees see only their own requests. | Maya approves it |

**Refused: can view, but may not decide (R1–R3)**

Each of these is refused with "You cannot decide this request." and nothing changes.

| ID | Given | When |
|---|---|---|
| AR-12 | Maya raised 101 | Maya approves 101, and Maya rejects 101 |
| AR-14 | Alex is an administrator | Alex **approves** 101 |
| AR-15 | Same | Alex **rejects** 101 with a comment |
| AR-16 | A Submitted request whose assigned reviewer is **Alex (admin)** (test-only fixture) | Alex approves it, and Alex rejects it |
| AR-18 | A Submitted request **raised by Priya** with **Priya** as its assigned reviewer (test-only fixture; nothing in the app can create this) | Priya approves it, and Priya rejects it |

**Refused: not Submitted (R4)**

Each of these is refused with "Only a submitted request can be decided." and nothing changes.

| ID | Given | When |
|---|---|---|
| AR-20 | 102 is Approved, assigned to Daniel | Daniel approves 102 again |
| AR-21 | 104 is Rejected, assigned to Daniel | Daniel rejects 104 again |
| AR-22 | A Cancelled request assigned to Priya | Priya approves it |
| AR-23 | A Draft request assigned to Priya | Priya approves it |

**Refused: input, existence and identity (R5, R9)**

| ID | Given | When | Then |
|---|---|---|---|
| AR-30 | 103 is Submitted, assigned to Priya | Priya rejects with "", with "   ", or with no comment | Refused: "A comment is required to reject a request." |
| AR-31 | Any user | Decides request 999, or request "abc" | Refused: "Request not found." for 999, and "Request ID must be a number." for "abc". |
| AR-32 | No user selected, or user 6 (inactive) | Approves or rejects 101 | Refused: "Select a current user." for no user, and "The selected user is unavailable." for user 6. |

**Order of checks**

The order is id → existence and view → may decide → status → comment.

| ID | Given | When | Then |
|---|---|---|---|
| AR-40 | 102 is Approved, assigned to Daniel | Priya, who can't view 102, approves it | Refused with "Request not found.": neither the request's existence nor its status is revealed. |
| AR-41 | 102 is Approved | Alex (admin, can view) approves it | Refused with "You cannot decide this request.": permission is checked before status. |
| AR-42 | 103 is Submitted | Alex rejects 103 with an empty comment | Refused with "You cannot decide this request.": permission is checked before the comment. |

**Screens (R1–R3, R6, R7, R10)**

| ID | Given | When | Then |
|---|---|---|---|
| AR-50 | Priya is the assigned reviewer of Submitted 101 | Priya opens 101 | She sees Approve, a comment box, and Reject, which stays disabled until a comment is typed. This is existing behavior. |
| AR-51 | The viewer isn't the assigned reviewer, **or** the request isn't Submitted | The viewer opens it | No Approve or Reject controls. This is existing behavior. |
| AR-52 | The viewer is the assigned reviewer but lacks the reviewer role, **or** raised the request | The viewer opens a Submitted request | No Approve or Reject controls. This is new. |
| AR-53 | Priya approves or rejects 101 | The action succeeds | The details and the list show the new status without a reload, and the details show "Decided by Priya Menon" and "Decided on" with the date. |
| AR-54 | A decision is refused by the server | It returns | The server's message appears in the page's alert banner. This is existing behavior. |
| AR-55 | 102 or 104, decided before decisions were recorded (seed data) | Anyone allowed opens it | "Decided by" and "Decided on" show **"Not recorded"** (see Q11). |
| AR-56 | 101 (Submitted), or any request that is Draft or Cancelled | Opened | No "Decided by" or "Decided on" rows. Cancelling is not a decision. |

## Design

**Data.** A new, additive table, created in `server/src/db.js` → `migrate` with `CREATE TABLE IF NOT EXISTS`:

```
request_decisions
  request_id     INTEGER PRIMARY KEY REFERENCES requests(id)   -- one decision per request
  decided_by_id  INTEGER NOT NULL REFERENCES users(id)
  decided_at     TEXT NOT NULL                                  -- ISO-8601 UTC
```

- It's a separate table rather than new columns on `requests`, because there is no migration framework. A new table reaches existing local databases on the next start without `db:reset` (`docs/architecture.md` §6), which is the same approach as request comments.
- The `requests` table and the seed data don't change, so existing `SELECT * FROM requests` snapshots in the tests stay valid.
- No decision rows are seeded, which gives AR-55.

**Server rules** (`server/src/requests.js`):

- **One visibility rule.** Extract the boolean view test inside `getVisibleRequest` into an exported `canViewRequest(user, request)`. `getVisibleRequest` keeps its current behavior by calling it. This avoids writing the view rule a third time (`CLAUDE.md`: keep the visibility copies in sync).
- **`loadDecidableRequest`** becomes:
  1. id not an integer → 400 `INVALID_REQUEST_ID`
  2. row missing **or `!canViewRequest(user, request)`** → 404 `REQUEST_NOT_FOUND` "Request not found." (R8)
  3. `assignedReviewerId !== user.id` **or** `user.role !== "reviewer"` **or** `requesterId === user.id` → 403 `REQUEST_FORBIDDEN` "You cannot decide this request." (R1–R3)
  4. status not Submitted → 409 `REQUEST_NOT_DECIDABLE`
  5. for reject only, the existing comment check
- **`approveRequest` and `rejectRequest`** run the status `UPDATE` and `INSERT INTO request_decisions (request_id, decided_by_id, decided_at)` in **one transaction**, `BEGIN`/`COMMIT` with `ROLLBACK` on error, so both are saved or neither is (R10). The same `now` value is used for `updated_at` and `decided_at`.
- **`requestSelect`** gains a `LEFT JOIN` to `request_decisions`, and a `LEFT JOIN users decider`, returning `decidedById`, `decidedByName` and `decidedAt`. These are null when there is no decision. It's an additive change to every request response; no existing field changes (`constitution.md` R4).
- No route changes. No new error codes. All SQL stays parameterized.

**Client.**

- `client/src/components/RequestDetails.jsx`:
  - The decision controls require `status === "Submitted"`, `assignedReviewerId === currentUserId`, `currentUserRole === "reviewer"` and `requesterId !== currentUserId` (AR-50 to AR-52).
  - For Approved or Rejected requests, add "Decided by" (`decidedByName`) and "Decided on" (`decidedAt`, the existing date format) to the details grid. Use "Not recorded" when they're null (AR-55).
- `client/src/App.jsx` passes `currentUserRole={currentUser?.role}`. This is UX only; the server enforces the rules (R3 of the constitution).

**Tests.**

- **Server**, `server/test/app.test.js`, approve/reject block:
  - Add AR-11, AR-13, AR-14, AR-17, AR-18 and AR-40 to AR-42, and assert `decidedById` and `decidedAt` for AR-01 and AR-02.
  - Add fixtures in the block's `before`, with IDs outside every existing range: 203 (assigned to Alex), 204 (raised by Rahul, assigned to Maya) and 205 (raised by Priya, assigned to Priya).
  - Every refusal snapshots both the `requests` row and its `request_decisions` row.
- **Server**, a **changed existing test:** "denies a reviewer who isn't assigned to the request from approving it" (Daniel → 103) currently expects 403 `REQUEST_FORBIDDEN`. Under R8 it must expect 404 `REQUEST_NOT_FOUND`. This is an intended behavior change, approved by the product owner as Q5.
- **Server**, a new `server/test/decisions-http.test.js`, following the `comments-http.test.js` pattern. It covers the status codes and error envelope for AR-01, AR-02, AR-10, AR-12, AR-16, AR-20, AR-30, AR-31 and AR-32.
- **Client**, `client/src/components/RequestDetails.test.jsx`:
  - Cover AR-52, AR-53's "Decided by" rendering, AR-55 and AR-56.
  - Existing tests AC-10 and AC-11 need the new `currentUserRole` prop wherever the controls should show.

**Docs**, in the same change (`CLAUDE.md`):

- `docs/domain.md`:
  - §2 and §6: the reviewer role and no self-decision. Remove the two resolved open questions about the role check and self-review.
  - §4: the new "Decided by / Decided on" fields.
  - §7: the "Request not found." case for deciding.
- `docs/architecture.md`:
  - §3.2 and §5: the new check order, `canViewRequest`, and the decision transaction.
  - §6: the `request_decisions` table.
  - §8: the new test file.
- `.claude/agents/authorization-reviewer.md`: update its known-gap line, since decide now checks role and self-decision. The 404 for non-viewers also changes the documented check order for decide.

## Constraints and unresolved questions

### Repository constraints that apply

- **Error shape and codes are preserved** (`constitution.md` R4). Two deliberate behavior changes are approved by the product owner:
  - non-viewers now get 404 when deciding (Q5)
  - decided requests return three extra fields (Q7)

  No new error codes.
- **Enforcement is server-side**, and client hiding is UX only (R3). SQL is parameterized only; the new queries use `?` placeholders.
- **The simulated identity is kept** (R9).
- **Stay in scope** (R5): no reassignment, multi-level approval, notifications, reopening or approval comments. Request **history** (a timeline of changes) stays a separate exercise. This spec records only the single decision that confirms the reviewer's responsibility (Q7).
- **Every refused example needs evidence that nothing changed** (R6).
- **Don't change the seeded users or requests 101–105.** Fixtures go in their own ID range, and the server test DB is shared, so order matters (`CLAUDE.md`).
- **Before completion:** `npm test`, `npm run lint` and `npm run build` must pass, and the diff gets the authorization review and the verification check (R7, W4).

### Product owner decisions (2026-10-31, Sagar Sharma)

| # | Question | Decision |
|---|---|---|
| Q1 | What does this exercise deliver? | The rules in this spec, R2, R3, R7 and R8, plus the missing test evidence. Sagar Sharma is the engineer of record and the technical lead. |
| Q3 | Can a requester decide their own request? | **No.** Self-decision is blocked (R3). |
| Q4 | Are today's error messages useful enough? | **Yes.** They are kept (R9). |
| Q5 | Should a user who can't decide still be told the request exists? | **No.** Non-viewers get "Request not found." (R8). |
| Q6 | Should approval accept an optional comment? | **Ignore.** It's not part of this exercise. |
| Q7 | Is saving the status enough? | **No.** Recording who decided and when is needed, to confirm the reviewer's responsibility. Store it and show it (R7). |
| Q8 | What about inactive reviewers? | "Cannot assign to inactive user." Nothing in the app assigns reviewers, so there's no change in this exercise. |
| Q10 | Who is the originator? | "Not needed." The originator is not required for this intent. |
| Q11 | What do "Decided by" and "Decided on" show for requests decided before decisions were recorded, such as seeded 102 and 104? | **"Not recorded"** (AR-55). |
| Q12 | Should opening, cancelling or commenting on a request you can't view also hide its existence, like R8? | **No change.** Opening, cancelling or commenting on a request you can't view keeps saying "You cannot view this request." or "You cannot cancel this request." R8 applies to approve and reject only. |

No questions remain unresolved.

## Approval record
Decision: accepted
Approver (reviewer): Technical lead — Sagar Sharma
Date: 2026-10-31
Scope questions resolved by product owner: Sagar Sharma, 2026-10-31. Q3: block self-decision (new rule R3). Q5: non-viewers get "Request not found." when deciding (new rule R8). Q7: record and show who decided and when (new rule R7). The intent had listed decision history as a separate exercise; this adds only the single decision record, not history. Q6: ignored. Q8: no assignment to inactive users, no change here. Q10: originator not required. Q11: "Not recorded" for decisions made before tracking. Q12: R8 applies to approve/reject only; the open, cancel and comment messages are unchanged.

## Findings routed back here
None yet.
