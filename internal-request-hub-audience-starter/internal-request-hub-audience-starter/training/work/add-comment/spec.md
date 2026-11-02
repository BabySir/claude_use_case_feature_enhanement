# Specification: Add a comment to a request

Intent: training/work/add-comment/intent.md (accepted 2026-10-31, approver Sagar Sharma)
Engineer (drafter): Claude Code, drafted for Sagar Sharma
Reviewer (approver): Sagar Sharma (sagar.sharma@trenser.com)
State: accepted

## Behavior and acceptance examples

### Confirmed rules

These come from GitHub issue #5 and the accepted intent. They are not open to change in this spec.

- **R1:** Anyone who can view a request can add a comment to it, from the request's detail page.
- **R2:** "Can view" means exactly today's rule for opening a single request: the requester (employee), the assigned reviewer, or any administrator (`docs/domain.md` section 5). A user who can't view the request can neither add nor read its comments.
- **R3:** A comment needs non-empty text. An empty or whitespace-only comment is refused with a useful error, and nothing is stored.
- **R4:** Comments are shown oldest first, each with its author and timestamp.
- **R5:** Adding a comment never changes the request's status, priority or reviewer comment (the existing rejection reason).
- **R6:** Editing, deleting, threaded replies, notifications, and comments on anything other than a request are out of scope.

### Examples

These use the existing seed data:

- **Users:** 1 Maya (employee), 2 Rahul (employee), 3 Priya (reviewer), 4 Daniel (reviewer), 5 Alex (admin), 6 Former Reviewer (inactive).
- **Request 101:** Submitted, raised by Maya, assigned to Priya.
- **Request 103:** Submitted, raised by Rahul, assigned to Priya.

"Refused" means nothing is stored and the user sees an error message.

**Who may comment (R1, R2)**

| ID | Given | When | Then |
|---|---|---|---|
| CMT-01 | Maya is the requester of 101 | Maya adds "Any update on delivery?" to 101 | Stored. It appears on 101 with author Maya and a timestamp. |
| CMT-02 | Priya is the assigned reviewer of 101 | Priya adds a comment to 101 | Stored and shown with author Priya. |
| CMT-03 | Alex is an administrator | Alex adds a comment to 103 | Stored and shown with author Alex. |
| CMT-04 | Rahul is not the requester of 101 | Rahul adds a comment to 101 | Refused with the existing "cannot view" outcome (see Q7). Nothing stored. |
| CMT-05 | Daniel is a reviewer, but not assigned to 101 | Daniel adds a comment to 101 | Refused, as in CMT-04. |
| CMT-06 | Any user | Comments on request 999, which doesn't exist | Refused: "Request not found." |
| CMT-07 | Any user | Comments on request "abc" | Refused: "Request ID must be a number." |
| CMT-08 | No user selected, or user 6 (inactive) | Adds or reads comments | Refused with the existing identity messages ("Select a current user." / "The selected user is unavailable."). |

**Empty or whitespace-only text (R3)**

| ID | Given | When | Then |
|---|---|---|---|
| CMT-10 | Maya on 101 | Submits "" | Refused with a clear message (wording: Q6). No comment stored. |
| CMT-11 | Maya on 101 | Submits "   " (spaces or newlines only) | Refused, as in CMT-10. |
| CMT-12 | Maya on 101 | Submits with the text missing entirely | Refused, as in CMT-10. |
| CMT-13 | Maya on 101, comment box empty or whitespace-only | Looks at the "Add comment" button | The button is disabled, matching the existing Reject control. The server still enforces CMT-10 to CMT-12. |

**Comment visibility (R2)**

| ID | Given | When | Then |
|---|---|---|---|
| CMT-20 | 101 has comments from Maya and Priya | Maya, Priya or Alex opens 101 | They see all of 101's comments. |
| CMT-21 | Same | Rahul or Daniel asks for 101's comments | Refused, as in CMT-04. No comment content is returned. |
| CMT-22 | Maya is viewing 101 with comments | The selector is switched to Rahul | 101's comments are no longer shown. Selecting a new user already clears the open request. |

**Order, author and timestamp (R4)**

| ID | Given | When | Then |
|---|---|---|---|
| CMT-30 | Maya comments on 101, then Priya does | Anyone allowed opens 101 | Maya's comment is listed above Priya's. |
| CMT-31 | Two comments get the same timestamp | Listed | They appear in the order they were stored. |
| CMT-32 | A comment exists | Shown | It shows the author's name and when it was posted (display precision: Q4). |
| CMT-33 | A new comment is added | Immediately afterwards | It appears at the bottom of the list without reloading the page. |

**Status, priority and reviewer comment unchanged (R5)**

| ID | Given | When | Then |
|---|---|---|---|
| CMT-40 | 101 is Submitted, Medium priority, with no reviewer comment | Maya comments | 101 is still Submitted and Medium, with no reviewer comment. |
| CMT-41 | 101 has comments | Priya then approves or rejects 101 | The decision works exactly as today. Comments don't block it. |
| CMT-42 | 104 is Rejected with reviewer comment "Please attach the workplace assessment reference." | Rahul comments (if allowed, see Q2) | 104 is still Rejected, and the reviewer comment text is unchanged. |
| CMT-43 | Priya rejects 103 with a reason | The detail page is shown | The rejection reason still appears in its own "Reviewer comment" box, separate from the new comments list. |

## Design

**Data.** One new table, created in `server/src/db.js` → `migrate` with `CREATE TABLE IF NOT EXISTS` and the same style as the existing tables:

```
request_comments
  id          INTEGER PRIMARY KEY
  request_id  INTEGER NOT NULL REFERENCES requests(id)
  author_id   INTEGER NOT NULL REFERENCES users(id)
  body        TEXT NOT NULL
  created_at  TEXT NOT NULL        -- ISO-8601 UTC, like requests.created_at
INDEX idx_request_comments_request ON request_comments(request_id, created_at, id)
```

- The `requests` and `users` tables don't change, and no seed rows are added or changed.
- Because the table is additive, an existing local database picks it up on the next start without `db:reset` (`docs/architecture.md` section 6).

**Server rules.** These live in a new module, `server/src/comments.js`, which follows the `requests.js` pattern: pure functions that take `(db, user, …)` and throw `HttpError`.

- `listComments(db, user, requestId)`: calls `getVisibleRequest(db, user, requestId)` first, which gives the 400, 404 and 403 behavior in CMT-04 to CMT-07 and CMT-21. It then selects that request's comments, joined with `users` for `authorName`, `ORDER BY created_at ASC, id ASC` (CMT-30, CMT-31).
- `addComment(db, user, requestId, text)`: runs the same `getVisibleRequest` check, then validates that `text` is a string with non-empty trimmed content. If not, it throws `HttpError(400, "COMMENT_TEXT_REQUIRED", <message per Q6>)`. Otherwise it inserts one row and returns it in the list's shape.
- `addComment` **never writes to `requests`** (R5, CMT-40). If Q1 is decided as "update Last updated", this becomes one extra `UPDATE requests SET updated_at`.
- Reusing `getVisibleRequest` keeps comment access identical to request access by construction (R2). Comments don't touch the list's separate visibility clause.

**API.** Added to `server/src/app.js`, using the existing route shape: identity from `?currentUserId=`, a `try/catch` that calls `next(error)`, and the `{ data }` envelope.

| Method and path | Body | Success |
|---|---|---|
| `GET /api/requests/:id/comments?currentUserId=N` | none | `200 { data: Comment[] }` |
| `POST /api/requests/:id/comments?currentUserId=N` | `{ "text": "…" }` | `201 { data: Comment }` |

`Comment = { id, requestId, authorId, authorName, body, createdAt }`, in camelCase like the request fields. Errors use the existing `{ error: { code, message } }` envelope.

**Client.**

- `client/src/api.js`: add `loadComments(requestId, currentUserId)` and `addComment(requestId, currentUserId, text)`. They follow the existing pattern and unwrap `.data`.
- `client/src/App.jsx`:
  - Hold `comments` state.
  - In `openRequest`, load the comments alongside the request.
  - Clear the comments wherever the selected request is cleared, which covers the user switch (CMT-22).
  - On submit, append the returned comment (CMT-33).
  - Errors go to the existing alert banner.
- `client/src/components/RequestDetails.jsx`: add a comments section below the existing details and reviewer-comment box.
  - The section has the list (author, timestamp, text), a textarea, and an "Add comment" button.
  - The button is disabled until the trimmed text is non-empty, mirroring the Reject control (CMT-13).
  - Clear the textarea after a successful post.
  - The labels must be visibly distinct from "Reviewer comment" (Q9).
  - The section is shown for any request the user has opened, because opening already proves they can view it.

**Tests.**

- **Server** (`server/test/app.test.js`): add a `describe("comments")` block covering CMT-01 to CMT-08, CMT-10 to CMT-12, CMT-21, CMT-30, CMT-31, CMT-40 and CMT-42.
  - Use requests whose state earlier blocks leave unchanged, or insert block-scoped fixture rows with IDs outside 101–105, as the approve/reject block already does.
  - The test database is shared, so ordering matters (`CLAUDE.md`).
- **Client** (`RequestDetails.test.jsx`): cover the list rendering, CMT-13 and CMT-43.
- **Client** (`App.test.jsx`): its fetch stub matches exact URLs. It only fails on comment URLs if a test opens a request, so add the comments URL to any test that does.

## Constraints and unresolved questions

### Repository constraints that apply

- Access is enforced on the server. Hiding UI is only a convenience (`docs/architecture.md` section 5).
- Authorship comes from the simulated `currentUserId`. Anyone can comment as any active user until real sign-in exists (`docs/domain.md` section 3). That is accepted for this change, and not fixed by it.
- No migration framework exists, so the new table must be additive (see Design).
- The seeded users and requests 101–105 must not change, because existing tests depend on them.
- This is the first write action for administrators, limited to comments (intent, Scope and constraints).
- Out-of-scope items (R6) must not be partially built: no edit or delete endpoints, and no reply links.
- `npm run lint`, `npm test` and `npm run build` must pass, matching CI.

### Unresolved questions

These are carried from the intent; none has been answered yet. Each has a **proposed default**, which this design builds in until the product owner decides. Each default can be reversed cheaply.

| # | Question | Proposed default | Affects |
|---|---|---|---|
| Q1 | Does a comment update the request's "Last updated" date? | No. Comments don't touch the request row. | CMT-40, Design `addComment` |
| Q2 | Can comments be added at every status (Draft, Approved, Rejected, Cancelled)? | Yes. R1 has no status condition. | CMT-42 |
| Q3 | Who can comment on Drafts? This depends on the Draft-visibility questions open in `docs/domain.md` section 5. | Whoever can view the Draft today. | R2 |
| Q4 | Should timestamps show the time, and in which time zone? | Date and time, in the viewer's local time zone. | CMT-32 |
| Q5 | Maximum comment length? | None enforced. | CMT-10 to CMT-12 |
| Q6 | Wording of the empty-comment error? | "Comment text is required.", in the style of the existing rejection message. | CMT-10 to CMT-12 |
| Q7 | Should "can't view" look the same as "not found" (existence disclosure, `docs/domain.md` section 7)? | Keep today's "You cannot view this request." for consistency. | CMT-04, CMT-05, CMT-21 |
| Q8 | Do comments by later-deactivated users keep the author's name? | Yes. The join doesn't filter on `active`. | CMT-32 |
| Q9 | UI name for the feature, so it isn't confused with "Reviewer comment"? | Section heading "Comments", with "Add comment" for the input. | CMT-43 |
| Q10 | Should stored text be trimmed of surrounding whitespace, as rejection reasons are? (New: the issue and intent are silent.) | Yes, store the trimmed text. | CMT-01 |

Q1–Q9 are product decisions. If any of them changes the scope in `intent.md`, record it under "Scope questions resolved by product owner" below. Q10 is a behavior detail the reviewer can settle.

## Approval record
Decision: accepted
Approver (reviewer): Sagar Sharma (sagar.sharma@trenser.com)
Date: 2026-10-31
Scope questions resolved by product owner: Sagar Sharma (product owner on intent.md), 2026-10-31 — Q1–Q10 accepted at their proposed defaults as written in the Unresolved questions table. No change to intent.md scope.

## Findings routed back here
None yet.
