# Implementation plan: Add a comment to a request

Intent: training/work/add-comment/intent.md (accepted 2026-10-31)
Specification: training/work/add-comment/spec.md (accepted 2026-10-31; Q1–Q10 accepted at their proposed defaults)
Engineer (owner): Claude Code, drafted for Sagar Sharma
Reviewer (approver): Sagar Sharma (sagar.sharma@trenser.com)
State: accepted

## Repository evidence

### Observed (read in the code, 31 Oct 2026)

**Schema**

- `server/src/db.js` → `migrate` (22) creates `users`, `categories` and `requests` with `CREATE TABLE IF NOT EXISTS`, and runs on every start. `PRAGMA foreign_keys = ON` (15). There is no comments table.
- `seed` (57) only inserts when `users` is empty.

**Server: the visibility rule**

- `server/src/requests.js` → `getVisibleRequest(db, user, requestId)` (34) is the single-request visibility rule.
  - A non-integer id gives 400 `INVALID_REQUEST_ID` "Request ID must be a number."
  - A missing request gives 404 `REQUEST_NOT_FOUND`.
  - Otherwise it passes for the admin, the requester (employee) and the assigned reviewer, and gives 403 `REQUEST_FORBIDDEN` "You cannot view this request." to everyone else.
  - It is exported, so it can be reused without changes.
- The list uses a separate `visibilityClause` (128). The spec ties comments to the single-request rule only.

**Server: validation and errors**

- `rejectRequest` (87) is the existing pattern for required text: `typeof comment === "string" ? comment.trim() : ""`, then a 400 with a code and message.
- `server/src/http-errors.js` → `HttpError` and `errorResponse`.
- The error middleware in `server/src/app.js` (97) maps `error.status` to a response, and malformed JSON to 400 `INVALID_JSON`.

**Server: routes**

- `server/src/app.js` routes (45–88) all follow one shape: `getCurrentUser(db, request.query.currentUserId)`, call a domain function, `response.json({ data })`, `catch → next(error)`. All existing routes respond with 200.
- `getCurrentUser` (`server/src/current-user.js` 3) gives 400 `CURRENT_USER_REQUIRED` or 401 `INVALID_CURRENT_USER`.
- The SPA catch-all (`app.js` 90–95) is registered **after** the API routes, so new `/api` routes added beside the existing ones win.
- `express.json()` (`app.js` 22) uses Express's default body limit, 100 kB.

**Client**

- `client/src/api.js` → `requestJson` (1) wraps `fetch`, throws the server's `error.message`, and the endpoint functions unwrap `.data`.
- `client/src/App.jsx`:
  - Owns all state.
  - The `useEffect` on `currentUserId` (29) calls `setSelectedRequest(null)` when the user switches.
  - `openRequest` (40) loads one request.
  - The action handlers refetch the list and set `error`, which renders as the alert banner.
- `client/src/components/RequestDetails.jsx`:
  - The reject control is the pattern to copy: a labelled textarea, and a button disabled while `!text.trim()`.
  - The textarea is reset by a `useEffect` keyed on `request?.id` and `request?.status`.
  - The reviewer-comment box is `.review-note`.
  - `formatDate` shows the date only (day, month, year).

**Tests and CI**

- `server/test/app.test.js` calls the domain functions only, against **one shared** `createDatabase(":memory:")` (`before`, top of the file). Blocks run in order, and the mutations stick:
  - After the existing blocks, 101 is **Cancelled** and 103 is **Rejected**. 102, 104 and 105 are unchanged.
  - The approve/reject block (153) inserts block-scoped fixtures 201 and 202. That is the precedent for test-only rows.
- There are no HTTP-level tests (`docs/architecture.md` section 8).
- `client/src/App.test.jsx` stubs `fetch` with exact URL matching and never opens a request. `RequestDetails.test.jsx` renders the component with props.
- CI (`.github/workflows/ci.yml`) runs `lint`, `test` and `build`.

### Assumptions (not verified by running)

- Node's test runner (`node --test` in `server/`) discovers a new `server/test/*.test.js` file automatically, by its default pattern.
- An existing `server/data/request-hub.db` gains the new table on the next start, without `db:reset`, because `migrate` is additive and idempotent.

## Approach and tradeoffs

**Chosen approach:** the spec's design, applied in the fewest files.

1. **Schema:** one additive table, `request_comments`, plus one index, in `migrate`. No seed changes.
2. **Rules:** a new `server/src/comments.js` with `listComments` and `addComment`. Both call `getVisibleRequest` first, so comment access equals request access by construction. `addComment` trims and validates the text (Q10, Q6) and inserts one row. It **never writes to `requests`** (Q1).
3. **Routes:**
   - `GET /api/requests/:id/comments`, responding 200.
   - `POST /api/requests/:id/comments` with body `{ text }`, responding **201**. This is the only route that uses 201, as the spec specifies.
4. **Client:**
   - Two `api.js` functions.
   - `App.jsx` adds `comments` state, loaded together with the request in `openRequest`, cleared with the selection, and appended to after a post.
   - `RequestDetails.jsx` adds a "Comments" section: a list with author, date and time, and text; a textarea; and an "Add comment" button disabled while the trimmed text is empty.
5. **Docs:** update `docs/domain.md` and `docs/architecture.md`, as `CLAUDE.md` requires when documented behavior changes.

**Tradeoffs considered**

- **Separate endpoints, or embed comments in `GET /api/requests/:id`?** Separate endpoints, as the spec says. Embedding would change the shape returned by `getVisibleRequest` and by every action endpoint, which all reuse `requestSelect`. That would ripple into the existing tests.
- **Add rules to `requests.js`, or a new module?** A new module, as the spec says. It keeps `requests.js` unchanged apart from the existing export it already has.
- **HTTP tests (new pattern), or domain tests plus manual checks only?** This plan adds **one small HTTP test file**, using `createApp` and `app.listen(0)` with the global `fetch`, and **no new dependencies**. Without it, the following could only be checked by hand:
  - the identity errors (CMT-08)
  - the 201 status
  - parsing the body text
  - registering the routes

  It's optional. If the reviewer prefers, checkpoint 3's HTTP tests can be replaced by the manual curl checks listed there (see Open questions).
- **Time display (Q4):** add a `formatDateTime` helper using `Intl.DateTimeFormat` with the date plus hour and minute, in the viewer's local time zone. The existing `formatDate` is left untouched.

## Ordered checkpoints

Each checkpoint ends with `npm run lint` and `npm test` both passing. Stop at any failure.

1. **Schema**: `server/src/db.js`
   - Change: in `migrate`, add `request_comments (id INTEGER PRIMARY KEY, request_id INTEGER NOT NULL REFERENCES requests(id), author_id INTEGER NOT NULL REFERENCES users(id), body TEXT NOT NULL, created_at TEXT NOT NULL)` and `CREATE INDEX IF NOT EXISTS idx_request_comments_request ON request_comments(request_id, created_at, id)`.
   - Verify:
     - The existing tests still pass, with 27 server tests unchanged.
     - Start the server once against the existing local DB (`npm start` or `npm run dev`). Confirm it starts, and that `node -e` with `node:sqlite` lists `request_comments` in `sqlite_master`.
     - Confirm no `db:reset` was needed.

2. **Domain rules**: new `server/src/comments.js` and `server/test/app.test.js`
   - Change:
     - `listComments(db, user, requestId)` calls `getVisibleRequest`, then runs `SELECT c.id, c.request_id AS requestId, c.author_id AS authorId, u.name AS authorName, c.body, c.created_at AS createdAt FROM request_comments c JOIN users u ON u.id = c.author_id WHERE c.request_id = ? ORDER BY c.created_at ASC, c.id ASC`. The join has no `active` filter (Q8).
     - `addComment(db, user, requestId, text)` calls `getVisibleRequest`. It trims the text and, if that's empty or the text isn't a string, throws `HttpError(400, "COMMENT_TEXT_REQUIRED", "Comment text is required.")`. Otherwise it inserts with `new Date().toISOString()` and returns the new row in the list's shape.
   - Tests: append a `describe("comments")` block **at the end** of `app.test.js`.
     - Its `before` inserts block-scoped fixtures **301** (Submitted, requester 1, reviewer 3, Medium, `reviewer_comment` null) and **302** (Submitted, requester 1, reviewer 3). Request 101 is Cancelled by then, so 301 stands in for the spec's "101".
     - Reuse 104 (Rejected, unchanged by earlier blocks) for CMT-42.
     - For CMT-31, insert two rows directly with the same `created_at`.
   - Verify: `cd server && node --test --test-name-pattern="comments" test/app.test.js`, then `npm test`.

3. **API routes**: `server/src/app.js` and new `server/test/comments-http.test.js`
   - Change: add the two routes next to the other `/api/requests/:id/...` routes, in the existing shape. POST reads `request.body?.text` and responds `response.status(201).json({ data })`.
   - Tests: a new file that builds `createApp({ db: createDatabase(":memory:") })`, listens on port 0, and uses `fetch` to check:
     - GET returns 200 with `{ data: [] }`.
     - POST returns 201, followed by a GET that includes the new comment.
     - A missing or inactive `currentUserId` gets the 400 or 401 identity errors.
     - A non-numeric id gets 400.
     - An empty or whitespace text, or a missing body, gets 400 `COMMENT_TEXT_REQUIRED`.
     - A forbidden user gets 403.
     - It closes the server and the DB in `after`.
   - Verify: `npm test`.
   - Manual fallback, if HTTP tests are declined: `curl` against `npm run dev` for the same cases.

4. **Client**: `client/src/api.js`, `client/src/App.jsx`, `client/src/components/RequestDetails.jsx`, `client/src/styles.css`, and the client tests
   - `api.js`: `loadComments(requestId, currentUserId)` → GET, and `addComment(requestId, currentUserId, text)` → POST `{ text }`.
   - `App.jsx`:
     - Add `comments` state.
     - In `openRequest`, use `Promise.all([loadRequest, loadComments])` and set both.
     - Add `setComments([])` beside each `setSelectedRequest(null)`.
     - Add an `addCommentToSelectedRequest(text)` handler that appends the returned comment and routes errors to the banner.
     - Pass `comments` and `onAddComment` to `RequestDetails`.
   - `RequestDetails.jsx`:
     - Add a "Comments" section after the details, the `.review-note` box and the action controls.
     - The list is ordered as received, with author name, `formatDateTime(createdAt)` and body. Render the body as plain text. No `dangerouslySetInnerHTML`.
     - Add a textarea labelled "Add comment" and an "Add comment" button disabled while `!text.trim()`.
     - Reset the textarea on a request-id change (in the existing reset effect) and after a successful post. The handler resolves or rejects, so the component can clear on success.
   - `styles.css`: minimal styles for the comments list, with `white-space: pre-wrap` on the body.
   - Tests:
     - In `RequestDetails.test.jsx`: the list renders the authors and bodies in the given order, the button is disabled for empty or whitespace text and enabled otherwise, and the comments section is separate from the "Reviewer comment" box.
     - In `App.test.jsx`, a new test:
       - Stub users, list, detail, comments and the POST.
       - Open a request and see its comments.
       - Post a comment and see it appended.
       - Switch user and see the comments disappear.
   - Verify: `cd client && npx vitest run`, then `npm test`, `npm run lint` and `npm run build`.

5. **Docs**: `docs/domain.md`, `docs/architecture.md`
   - `domain.md`: add comments as an entity, add the who-can-comment and who-can-see rules, and add the new refusal message to section 7. Section 8 needs no removal, because comments weren't listed there. Note that administrators now have one write action.
   - `architecture.md`: add the new routes, module and table to sections 2–6, and note the new HTTP test file in section 8.
   - Keep the Confirmed / Inference / Open question labels.
   - Verify: review the diff only. There is no automated check.

6. **End-to-end manual walkthrough**: `npm run dev`, http://localhost:5173
   - As Maya, open REQ-101 (or another Submitted request), add a comment, and see it appear with author and time.
   - Switch to Priya, see Maya's comment, add a reply-style comment, and see the order.
   - Switch to Alex and see both.
   - Switch to Rahul, and see that 101 isn't listed.
   - Try a whitespace-only comment, and see the button disabled.
   - Approve as Priya, and see the status change with the comments still present.
   - Optionally, run `npm run db:reset` afterwards to restore the seed state.

## Acceptance-to-evidence map

| Acceptance example | Checkpoint | Automated check or manual observation |
| --- | --- | --- |
| CMT-01 requester comments | 2, 3, 6 | Domain test: Maya adds to 301, `listComments` returns it with `authorName` "Maya Nair" and `createdAt`. HTTP: POST returns 201. Manual walkthrough. |
| CMT-02 assigned reviewer comments | 2 | Domain test: Priya adds to 301 successfully. |
| CMT-03 admin comments | 2 | Domain test: Alex adds to 103 successfully. |
| CMT-04 non-requester employee refused | 2, 3 | Domain test: Rahul → 301 throws 403 `REQUEST_FORBIDDEN`, row count unchanged. HTTP: 403. |
| CMT-05 unassigned reviewer refused | 2 | Domain test: Daniel → 301 throws 403, row count unchanged. |
| CMT-06 request not found | 2 | Domain test: `addComment` and `listComments` on 999 throw 404 `REQUEST_NOT_FOUND`. |
| CMT-07 non-numeric id | 2, 3 | Domain test: "abc" throws 400 `INVALID_REQUEST_ID`. HTTP: `/api/requests/abc/comments` returns 400. |
| CMT-08 no user / inactive user | 3 | HTTP test: no `currentUserId` gives 400 `CURRENT_USER_REQUIRED`, user 6 gives 401 `INVALID_CURRENT_USER`, for GET and POST. (Manual curl if HTTP tests are declined.) |
| CMT-10 empty text | 2, 3 | Domain test: "" throws 400 `COMMENT_TEXT_REQUIRED`, row count unchanged. HTTP: 400 with message "Comment text is required." |
| CMT-11 whitespace-only text | 2, 3 | Domain test: "   \n\t" → same as CMT-10. |
| CMT-12 missing text | 2, 3 | Domain test: `undefined` → same as CMT-10. HTTP: POST with no body or `{}` → 400. |
| CMT-13 button disabled when empty | 4 | `RequestDetails.test.jsx`: disabled for "" and "   ", enabled after typing text. |
| CMT-20 viewers see all comments | 2, 6 | Domain test: `listComments` on 301 returns the same rows for Maya, Priya and Alex. Manual walkthrough. |
| CMT-21 non-viewers get nothing | 2, 3 | Domain test: `listComments` for Rahul or Daniel on 301 throws 403. No rows are returned. HTTP: GET returns 403 with no `data`. |
| CMT-22 user switch clears comments | 4, 6 | `App.test.jsx`: after switching the selector, the comment text is no longer in the document. Manual walkthrough. |
| CMT-30 oldest first | 2, 6 | Domain test: Maya then Priya on 301, list order is [Maya, Priya]. Manual walkthrough. |
| CMT-31 same-timestamp tie | 2 | Domain test: two rows inserted directly with the same `created_at` are listed in id order. |
| CMT-32 author and timestamp shown | 4, 6 | `RequestDetails.test.jsx`: the author name is rendered, and a time element shows a formatted date and time. The test avoids asserting a timezone-specific string (see Risks). Manual walkthrough. |
| CMT-33 new comment appears without reload | 4, 6 | `App.test.jsx`: after the POST resolves, the new text appears with no further GET of comments. Manual walkthrough. |
| CMT-40 status, priority and reviewer comment unchanged | 2 | Domain test: snapshot the `requests` row for 301 before and after `addComment`, and `deepEqual`, which also covers `updated_at` (Q1). |
| CMT-41 decision still works after comments | 2, 6 | Domain test: comment on 302, then `approveRequest(Priya, 302)` gives Approved, and the comments still list. Manual walkthrough. |
| CMT-42 rejected request keeps its reviewer comment | 2 | Domain test: Rahul comments on 104, then the snapshot is unchanged: still Rejected, same `reviewer_comment`. |
| CMT-43 reviewer comment kept separate | 4, 6 | `RequestDetails.test.jsx`: a request with `reviewerComment` and comments renders the "Reviewer comment" box and the "Comments" section as separate regions. Manual walkthrough. |

## Risks and recovery

**Authorization**

- A comment endpoint skipping the view check would leak or allow writes to other people's requests.
  - *Mitigation:* both functions call `getVisibleRequest` first, and CMT-04, -05 and -21 test **both** list and add.
  - *Recovery:* fix in the diff. Re-run checkpoint 2.
- Identity is the client-supplied `currentUserId`, so anyone can comment as any active user. This is accepted by the spec as an existing limitation, not introduced here.
- This is the first administrator write. It's intended (intent, Scope and constraints), and covered by CMT-03.

**State and test isolation**

- The server tests share one DB, so new fixtures could shift counts in earlier blocks.
  - *Mitigation:* the comments block goes **last**, with fixture ids 301 and 302 outside 101–105 and 201–202. Earlier assertions (for example "admin sees 5 requests") run before the fixtures exist.
  - *Recovery:* if an earlier test breaks, move the fixtures into a separate in-memory DB within the new block.

**Persistence**

- The new table is additive, so existing local DBs upgrade on start.
- Rolling back the code leaves an unused table, which is harmless. Removing it requires `npm run db:reset`, which deletes all local data.
- With `foreign_keys = ON`, comments can't reference a missing request or user. Nothing in the app deletes requests or users today.

**Integration**

- *Body limit:* the default `express.json()` limit (100 kB) is the effective maximum comment size (Q5: "none enforced"). A larger body gives Express's 413, which `errorResponse` turns into the generic envelope. That's acceptable. Flag it if the reviewer wants an explicit limit.
- *Opening requests quickly:* opening request A and then B quickly could show A's comments under B. The same race already exists today for `selectedRequest`.
  - *Mitigation:* load both with one `Promise.all` and set them together, which doesn't make it worse.
  - *Recovery, if it's observed:* ignore responses whose request id is no longer selected.
- *Client test brittleness:* the `App.test.jsx` stub matches exact URLs, so new calls must be stubbed. Assertions on the formatted date and time depend on the machine's timezone and locale, so tests should assert the author and body text and the presence of a timestamp, not an exact time string.
- *Rendering safety:* comment bodies are user text. Rendering them as React text children escapes them. Don't use HTML rendering.
- *Unknown `/api` paths in production* still return `index.html` (an existing gap, `docs/architecture.md` section 7). The new routes are registered before the catch-all, so they're unaffected.

**Docs drifting**

- If checkpoint 5 is skipped, `docs/domain.md` would be wrong ("Administrators are viewers only", no comments entity). Keep checkpoint 5 in the same change.

### Open questions for the reviewer

Each question has the engineer's recommendation filled in. A recommendation is not a decision: the reviewer confirms or overrides each one when deciding on the plan.

1. **HTTP test file:** checkpoint 3 adds the repository's first HTTP-level tests (no new dependencies). Accept it, or rely on manual curl for CMT-08 and the route wiring?
   - **Recommendation: accept the HTTP test file.** Without it, CMT-08, the 201 status, body parsing and route registration have no automated check, and CI would never catch a regression in them. It needs no new dependencies (`createApp` + `listen(0)` + global `fetch`). It also starts closing the gap `docs/architecture.md` section 8 records, at little cost.
2. **Docs in this change:** checkpoint 5 is included because `CLAUDE.md` asks for it. Confirm that the docs update ships with the code rather than separately.
   - **Recommendation: ship the docs in the same change.** `CLAUDE.md` asks for it. If the docs land separately, `docs/domain.md` would be wrong in the meantime ("Administrators are viewers only", no comments entity), and accepted docs that state false rules undermine the review process this change relies on.
3. **Rapid request switching:** accept the existing race as-is (risk above), or add a stale-response guard now? This plan proposes as-is.
   - **Recommendation: accept as-is for this change.** The race already exists for request details. The plan loads the request and its comments together with `Promise.all`, so it doesn't make things worse. A guard would change `openRequest` behavior beyond the spec's scope. If it's ever observed, fix it for requests and comments together, as its own change.
4. **Reviewer:** the plan's approver isn't named yet.
   - **Recommendation: Sagar Sharma reviews, unless a second engineer is available.** Sagar approved both `intent.md` and `spec.md`, so has the full context. A reviewer who didn't approve the spec would give a more independent check of the approach. Prefer one if available.

## Approval record
Decision: accepted — open questions 1–4 accepted as recommended (HTTP test file included; docs ship in the same change; rapid-switching race accepted as-is; reviewer Sagar Sharma)
Approver (reviewer): Sagar Sharma (sagar.sharma@trenser.com)
Date: 2026-10-31
Do not begin implementation while pending.

## Findings routed back here
None yet.
