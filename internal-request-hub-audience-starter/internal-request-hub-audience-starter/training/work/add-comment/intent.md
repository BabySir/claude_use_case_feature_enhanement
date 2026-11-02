# Intent: Add a comment to a request

Source issue: GitHub issue #5 — https://github.com/mjinto/internal-request-hub/issues/5
Originator: TBD — the issue author was not part of the fetched issue fields
Product owner (approver): Sagar Sharma (sagar.sharma@trenser.com)
State: accepted

## Problem and desired outcome

**Who and why.** The issue says that "Employees, reviewers, and administrators who can already see a request need a simple way to record a note on it — a clarifying question, context for a decision, or a follow-up — without changing the request's status."

**Today.** The application has no way to do this. The only free text a request carries is the single *reviewer comment*. Only the assigned reviewer can write it, and only as the required reason when rejecting a Submitted request. Nobody else can write anything on a request, and administrators can't change anything at all.

**Desired outcome.** Everyone who can view a request can add notes to it on the request's detail page, and everyone who can view the request can read them. The issue's acceptance criteria are:

1. A user who can view a request can add a comment to it from the request's detail page.
2. A new comment appears with its author and timestamp.
3. A user who cannot view a request cannot add a comment to it, and cannot see any of its comments.
4. An empty or whitespace-only comment is rejected with a useful error, and no comment is stored.
5. Comments appear in chronological order, oldest first.
6. Adding a comment does not alter the request's `status`, `priority`, or `reviewer_comment`.

## Scope and constraints

**In scope (from the issue):**

- Adding a text comment to a request from the request's detail page.
- Showing a request's comments, oldest first, each with its author and timestamp.
- Who can comment and read comments: anyone who can view the request. Per `docs/domain.md` section 5, that means the requester (employee), the assigned reviewer, and any administrator.
- Rejecting empty or whitespace-only text.

**Out of scope (from the issue):**

- Editing or deleting a comment.
- Threaded replies.
- Notifications.
- Comments on anything other than a request.

**Out of scope (inference: the issue doesn't ask for these):**

- Showing comments or comment counts in the request list.
- Changing the existing rejection reason (*reviewer comment*), or any status transition.
- Seeding sample comments.

**Constraints, checked against the repository and the accepted docs:**

- **The visibility rule must match viewing a request.** The issue says comments follow "the same rule that already governs viewing the request itself". Today that rule is enforced on the server when a single request is opened, and a near-copy is used for the list (`docs/architecture.md` section 5). Comment access has to follow the single-request rule exactly. It must be enforced on the server, not only by hiding UI.
- **Keep comments separate from the existing reviewer comment.** Requests already have a single *reviewer comment* field, holding the rejection reason. The new comments are a separate, many-per-request record. Acceptance criterion 6 forbids touching the existing field, and the UI and documents should keep the two clearly apart.
- **Status, priority and the decision stay unchanged.** Adding a comment must not change the request's status, priority or reviewer decision, for any status.
- **Administrators gain their first write action.** Today they are read-only (`docs/domain.md` section 2). The issue explicitly includes them, so this change gives administrators a first write action, limited to comments.
- **Authorship relies on the simulated identity.** There is no real sign-in. The author would be the user picked in "Viewing as", so authorship is only as trustworthy as that selector (`docs/domain.md` section 3, `docs/architecture.md` section 5).
- **Schema change.** There is no migration mechanism. Schema is created with `IF NOT EXISTS` on start-up (`docs/architecture.md` section 6).
  - *Inference:* a new, additive table would appear in existing local databases without a reset.
  - *Inference:* changing existing tables would require `npm run db:reset`.
- **Existing sample data and tests.** Server tests depend on the seeded users, the request IDs 101–105, and their order (`CLAUDE.md`). The change must not disturb the existing sample rows.
- **Out-of-scope items stay out.** Editing, deleting, threading and notifications must not be partially introduced.

## Open questions

1. **Does adding a comment update the request's "Last updated" date?** Criterion 6 lists status, priority and reviewer comment, but not the last-updated date that the detail page shows.
2. **Can comments be added at every status,** including Draft, Approved, Rejected and Cancelled? The issue's rule ("anyone who can already view") implies yes, but doesn't say so explicitly.
3. **Draft visibility.** `docs/domain.md` section 5 leaves two Draft questions open: whether reviewers should see Drafts assigned to them, and whether administrators should see other people's Drafts. Because comments follow viewing, whatever is decided there decides who can comment on Drafts.
4. **What "timestamp" means for display.** The detail page shows dates only (day, month, year), not times. Should comments show the time too, and in which time zone?
5. **Length limit.** Is there a maximum length for a comment? The issue sets none.
6. **Wording of the "useful error"** for empty comments. Should it follow the existing rejection message style ("A comment is required to reject a request.")?
7. **What a refused user is told.** When someone who can't view the request tries to read or add comments, should they get the existing "You cannot view this request" message, or should it look the same as "not found"? This connects to the open existence-disclosure question in `docs/domain.md` section 7.
8. **Comments by deactivated users.** If the author is later deactivated, should their comments still show with their name? Today, inactive users are hidden from the selector but their records remain.
9. **Name of the feature in the UI.** "Comment" is already used for the reviewer's rejection reason ("Reviewer comment"). What labels keep the two distinct, for example "Notes" or "Discussion"?
10. **Who is the originator, and who is the approving product owner?** Neither is stated in the issue or the repository.

## Approval record

Decision: accepted
Approver: Sagar Sharma (sagar.sharma@trenser.com)
Date: 2026-10-31
Notes: Accepted as drafted, with no amendments. Open questions 1–9 were not resolved at acceptance and must be answered in spec.md before implementation. Question 10 is answered for the approver; the originator is still TBD.

## Findings routed back here

None yet.
