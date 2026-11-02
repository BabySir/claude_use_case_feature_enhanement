# Intent: Approve or reject an assigned request

Source issue: GitHub issue #2 — https://github.com/mjinto/internal-request-hub/issues/2
Originator: TBD — the issue author was not part of the fetched issue fields
Product owner (approver): Sagar Sharma (named as product owner when this draft was requested)
State: accepted

## Problem and desired outcome

**Who and why.** The issue says: "Reviewers need to decide requests assigned to them without changing requests owned by another reviewer."

**Desired outcome.** The issue's confirmed rules are:

- "Only the assigned reviewer may approve or reject a request."
- "The request must be in `Submitted` status."
- "Rejection requires a reviewer comment."
- "A successful decision persists the new status."
- "A failed decision leaves the request unchanged."

Its acceptance criteria are:

1. The assigned reviewer can approve a submitted request.
2. The assigned reviewer can reject a submitted request after entering a comment.
3. An unrelated reviewer cannot decide the request.
4. An employee or administrator cannot decide the request.
5. A non-submitted request cannot be decided again.
6. Failed attempts return a useful error and do not change stored data.

**Today.** The repository already implements this behavior, so this change is mostly about confirming it, not building it:

- The assigned reviewer can approve, or reject with a required comment, a request that is Submitted.
- Everyone else is refused, and requests in any other status can't be decided.
- A refused attempt changes nothing.
- The Approve and Reject controls appear only for the assigned reviewer while a request is Submitted.

Sources: `docs/domain.md` §6–7, `docs/architecture.md` §3.2 and §5. Existing server tests cover most of the criteria at the domain level, and existing client tests cover the controls' visibility.

What isn't evidenced today, compared with the issue's criteria:

- **Criterion 3:** an unrelated reviewer is tested only for **approve**, not for **reject**.
- **Criterion 4:**
  - An administrator is tested only for **reject**, not for **approve**.
  - The requester is tested for approve. An employee who is **not** the requester isn't tested at all.
- **Criterion 6:** stored data is checked unchanged after each refusal at the domain level. But the approve and reject **routes** have no HTTP-level tests (`docs/architecture.md` §8). The error a user actually receives over the API is therefore unverified for these routes.

## Scope and constraints

**In scope (from the issue):**

- The assigned reviewer approving a Submitted request.
- The assigned reviewer rejecting a Submitted request with a comment.
- Refusing everyone else: an unrelated reviewer, an employee, an administrator.
- Refusing any request that isn't Submitted.
- A useful error, and no change to stored data, for every failed attempt.
- A successful decision persists the new status.

**Out of scope (from the issue):**

- Reviewer reassignment.
- Multi-level approvals.
- Notifications.
- Reopening a decided request.

**Out of scope (inference: the issue doesn't ask for these):**

- A comment on approval.
- Any change to cancellation, which is a separate later exercise (`constitution.md`, Status).
- Changes to the request comments feature.

**Constraints, checked against the repository and the accepted docs:**

- **Existing behavior and API must be preserved** (`constitution.md` R4) unless an accepted spec changes them:
  - the error shape `{ error: { code, message } }`
  - the codes `REQUEST_FORBIDDEN`, `REQUEST_NOT_DECIDABLE`, `REJECTION_COMMENT_REQUIRED`, `REQUEST_NOT_FOUND` and `INVALID_REQUEST_ID`
  - the user-facing messages in `docs/domain.md` §7
- **Refusal order is part of current behavior.** Permission is checked before status (`docs/architecture.md` §5). An unrelated user is told "You cannot decide this request." whatever the request's status.
- **Identity stays simulated** (`constitution.md` R9). "Assigned reviewer" means whoever is selected in "Viewing as", resolved on the server.
- **Enforcement stays on the server** (`constitution.md` R3). Hiding the controls in the UI is not the rule.
- **Seed data and test isolation.** The server tests depend on the seeded users, the requests 101–105 and their order, and the shared in-memory test database (`CLAUDE.md`, working notes). The approve/reject test block already uses fixtures 201–202, and the comments block uses 301–302.
- **Denied actions need evidence** (`constitution.md` R6): every refused case in criteria 3–6 needs its own verification, including that nothing changed.
- **Out-of-scope items stay out** (`constitution.md` R5).

## Open questions

1. **What is this exercise expected to deliver, given the behavior already exists?** Options:
   - verification only: map the criteria to the existing tests, and run the review tools
   - add the missing test evidence listed above
   - change behavior

   `constitution.md`, Status, already flags that this exercise's scope must be stated against existing behavior.
2. **Criterion 4, "an employee or administrator cannot decide the request".** Today the server checks only "is this user the assigned reviewer?", with no role check (`docs/architecture.md` §5; `docs/domain.md` §6, Open question). If an employee or administrator were ever set as a request's assigned reviewer, they could decide it. No data does this today, and nothing in the app can assign reviewers. Should the rule be "assigned reviewer **and** has the reviewer role"?
3. **Can a requester decide their own request** if they are also its assigned reviewer? It's the same gap as question 2, and is already an Open question in `docs/domain.md` §6.
4. **What counts as a "useful error"?** Are today's messages acceptable?
   - "You cannot decide this request."
   - "Only a submitted request can be decided."
   - "A comment is required to reject a request."
5. **What should an unrelated user be told?** Today they get "You cannot decide this request." for a request they can't even view, which confirms the request exists. `docs/domain.md` §7 has a related open question about existence disclosure. Should this change?
6. **Should approval accept an optional comment?** The issue requires one only for rejection. `docs/domain.md` §6 lists this as an open question.
7. **Is persisting the new status enough?** "A successful decision persists the new status": today the status and "Last updated" are saved, but not who decided or when as a separate record. Request history is a separate later exercise. Confirm that nothing more is expected here.
8. **Requests whose assigned reviewer is inactive can never be decided.** That is out of scope through reassignment, but confirm it should stay that way for this exercise (`docs/domain.md` §2, Open question).
9. **Where should the change folder live?** This draft is at `training/work/approve-or-reject/`, as requested. But `constitution.md` W1 and `training/add-comment/README.md` say feature folders live under `training/add-comment/`, and `training/work/README.md` doesn't exist. Which location is authoritative? (This is the constitution's carried-forward item 1.)
10. **Who is the originator?** The issue author wasn't among the fetched fields.

## Approval record

Decision: accepted
Approver: Sagar Sharma (product owner)
Date: 2026-10-31
Notes: Accepted as drafted, with no amendments. Open questions 1–10 were not answered at acceptance; they carry forward and must be resolved in spec.md (by the product owner where they affect scope) before implementation.
Product owner decisions, 2026-10-31 (Sagar Sharma):
- Q2: the reviewer role is required. Deciding a request needs the user to be its assigned reviewer **and** to have the reviewer role. An employee or administrator who is somehow the assigned reviewer can't decide it. This is a behavior change from today's assignment-only check.
- Q9: the folder is `training/work/approve-or-reject/`. `constitution.md` W1 was amended to name feature folders from the issue title under `training/work/`.

## Findings routed back here

None yet.
