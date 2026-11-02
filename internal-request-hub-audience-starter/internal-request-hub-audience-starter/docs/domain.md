# Internal Request Hub — Domain Guide

**Audience:** product owners and business reviewers.
**Status:** Accepted (31 Oct 2026). Describes what the application *does today*, not what it should do.
**Last reviewed against the application:** 31 Oct 2026.

## How to read this guide

Every rule carries one label:

- **Confirmed**: the application behaves this way today, and automated checks or the visible screens back it up.
- **Inference**: our best reading of intent or business meaning. The application doesn't state it outright. Please confirm or correct.
- **Open question**: the application doesn't settle this, or its behavior may not match what the business wants. A decision is needed.

---

## 1. Purpose and business area

The Internal Request Hub is an internal tool for **employee service requests**: an employee asks for something they need for their work, and a named reviewer approves or rejects it.

- **Confirmed:** The application tracks requests in four business categories: *Equipment*, *Software Access*, *Training* and *Workplace Services*.
- **Confirmed:** Its main jobs today are to let people see the requests that concern them, let a reviewer approve or reject a request waiting on them, let a requester withdraw (cancel) a request that is still waiting, and let anyone who can see a request add comments to it (section 4, *Comment*).
- **Inference:** The business area is internal services or procurement approvals (for example, IT, facilities or learning and development). The categories and sample requests ("Additional monitor", "API testing tool", "Advanced React workshop", "Ergonomic keyboard", "Design software license") point that way.
- **Confirmed:** The application **does not** fulfil requests. It records decisions only. Nothing happens after approval (no order is placed and no access is granted).

## 2. Roles

There are three roles. Every person has exactly one.

| Role | Plain meaning |
|---|---|
| Employee | A person who raises requests. |
| Reviewer | A person who decides on requests assigned to them. Only reviewers can approve or reject. |
| Administrator | A person with an organization-wide view of requests, who can comment but not change them. |

- **Confirmed:** An employee sees and acts only on requests they raised.
- **Confirmed:** A reviewer sees and acts only on requests assigned to them.
- **Confirmed:** An administrator can see every request but **cannot** cancel, approve or reject any of them. Adding a comment is the only thing an administrator can do to a request.
- **Open question:** Should administrators be able to step in (for example, approve, reject, cancel or reassign on someone's behalf)? Today they can't.
- **Open question:** Can a reviewer also raise requests of their own? Today a reviewer's list shows only requests assigned to them, so a request a reviewer raised would not appear in their list.

### People can be active or inactive

- **Confirmed:** Each person is either active or inactive. Inactive people don't appear in the user selector and can't use the application.
- **Confirmed:** The sample data includes one inactive reviewer ("Former Reviewer").
- **Open question:** If a request is assigned to a reviewer who later becomes inactive, nobody can decide it. No one else can approve or reject it, and no reassignment exists. What should happen?

## 3. Simulated identity (no real sign-in)

- **Confirmed:** There is **no real login**. At the top of the screen, a "Viewing as" selector lets anyone choose any active person and act as them.
- **Confirmed:** The application applies all visibility and permission rules to whoever is selected. Switching the selection immediately changes what is shown.
- **Confirmed:** When the application opens, it selects the first person in the list. The list is ordered employees first, then reviewers, then administrators, and by name within each group.
- **Inference:** This is a stand-in for demos and testing. It isn't meant as a security control, because anyone can pick anyone.
- **Open question:** Real sign-in needs a decision before any real use: how people authenticate, and where roles come from.

## 4. Business entities

### Request
The central item: something an employee has asked for.

| Field | Plain meaning | Label |
|---|---|---|
| Reference (e.g. REQ-101) | Unique request number shown to users. | Confirmed |
| Title | Short name of what is wanted. | Confirmed |
| Description | Free-text explanation or justification. | Confirmed |
| Category | Which of the four business areas it belongs to. Exactly one per request. | Confirmed |
| Priority | Low, Medium or High. | Confirmed |
| Requested by | The person who raised it. | Confirmed |
| Assigned reviewer | The one person responsible for deciding it. May be blank. | Confirmed |
| Status | Where the request is in its life (see section 6). | Confirmed |
| Reviewer comment | The reviewer's reason for rejecting it. Shown only when one exists. Separate from the request's *comments* (below). | Confirmed |
| Created / Last updated | Dates shown on the request. | Confirmed |
| Decided by / Decided on | Who approved or rejected the request, and the date. Shown only for Approved and Rejected requests. Requests decided before decisions were recorded show "Not recorded". | Confirmed |

- **Confirmed:** Priority is shown to users but **changes nothing**. It doesn't affect ordering, who reviews, or any deadline.
- **Open question:** What should priority mean in business terms (response time, ordering, escalation)?
- **Confirmed:** A request has at most one assigned reviewer. A request with no reviewer shows "Not assigned".
- **Confirmed:** "Last updated" changes when a request is cancelled, approved or rejected. Adding a comment does **not** change it.
- **Confirmed:** Approving or rejecting also records **who decided and when**, shown as "Decided by" and "Decided on". Cancellations and other changes record no actor; there is no fuller history.

### Comment
A note anyone who can see a request adds to it: a clarifying question, context for a decision, or a follow-up. A request can have any number of comments.

- **Confirmed:** Anyone who can view a request can add a comment to it, from the request's detail page. That's the requester, the assigned reviewer, or any administrator (section 5). This applies at every status, including Draft, Approved, Rejected and Cancelled.
- **Confirmed:** Anyone who can view a request can read all of its comments. Anyone who can't view the request can neither add nor read them.
- **Confirmed:** A comment needs text. An empty or whitespace-only comment is refused and nothing is saved, and the "Add comment" button stays disabled until something is typed. Extra spaces around the text are removed before it is saved.
- **Confirmed:** Comments are shown oldest first, each with its author's name and the date and time it was added. The time is shown in the viewer's own time zone.
- **Confirmed:** Adding a comment never changes the request's status, priority, reviewer comment or "Last updated" date. Approving and rejecting work the same whether or not a request has comments.
- **Confirmed:** Comments can't be edited or deleted. There are no replies to individual comments and no notifications.
- **Confirmed:** There is no length limit beyond the system's general size limit on what can be sent.
- **Inference:** A comment's author keeps their name on it even if they are later deactivated. Nothing hides it, but no screen or check exercises this case.
- **Inference:** Because sign-in is simulated (section 3), a comment's author is whoever was selected in "Viewing as". Authorship is only as trustworthy as that selector.

### Category
- **Confirmed:** There are four fixed categories: Equipment, Software Access, Training and Workplace Services. Users can't add, rename or remove them in the application.
- **Confirmed:** Category is a label only. It doesn't decide who reviews a request or how it is handled.
- **Inference:** Categories exist to group requests for reporting or routing later, but no such use exists today.

### Person (user)
- **Confirmed:** Each person has a name, an email address, a role and an active/inactive flag.
- **Confirmed:** Email addresses are shown nowhere for decision purposes and nothing is sent to them.

## 5. Who can see which requests

- **Confirmed:** An **employee** sees only requests they raised, in every status, including their own Drafts.
- **Confirmed:** A **reviewer** sees only requests assigned to them, in every status, including ones already decided or cancelled.
- **Confirmed:** An **administrator** sees every request in every status, including other people's Drafts.
- **Confirmed:** The list is ordered newest first by creation date. It shows the reference, title, status, category and priority, plus a count of requests.
- **Confirmed:** Opening a request outside your view is refused, even if you know or guess its reference number. The same applies to reading or adding its comments.
- **Confirmed:** There is no search, filtering or sorting choice.
- **Open question:** Should a reviewer see a request assigned to them while it is still a Draft? Today they would, because visibility depends only on assignment, not on status. The sample data has no Draft with a reviewer, so users won't see this yet.
- **Open question:** Should administrators see other people's unsent Drafts?

## 6. Status values and what happens at each

Five status values exist. **A status value existing does not mean there is a way to reach it.** The table says which moves the application actually supports.

| Status | Plain meaning | How a request gets here today | What can happen next |
|---|---|---|---|
| **Draft** | Started but not sent for review. | **No way in the application.** Only the sample data contains Drafts. | Nothing. Drafts can't be submitted, edited, cancelled or decided. |
| **Submitted** | Waiting for the assigned reviewer's decision. | **No way in the application.** Only the sample data contains Submitted requests. | The requester can cancel it. The assigned reviewer can approve or reject it. |
| **Approved** | The reviewer agreed. | The assigned reviewer approves a Submitted request. | Nothing. It is final. |
| **Rejected** | The reviewer declined, with a reason. | The assigned reviewer rejects a Submitted request and gives a comment. | Nothing. It is final. |
| **Cancelled** | The requester withdrew it. | The requester cancels their own Submitted request. | Nothing. It is final. |

Supporting rules:

- **Confirmed:** Only a **Submitted** request can be cancelled, approved or rejected. Requests in any other status can't be changed.
- **Confirmed:** Only the **requester** can cancel. A different employee, the assigned reviewer and an administrator are all refused.
- **Confirmed:** Only the **assigned reviewer** can approve or reject, and only if they have the **reviewer role** and **didn't raise the request** themselves. Another reviewer, the requester and an administrator are all refused. That includes an administrator or employee recorded as the assigned reviewer, and a reviewer assigned to their own request.
- **Confirmed:** Rejecting **requires a comment**. A blank or whitespace-only comment is refused, and the Reject button stays disabled until something is typed. Extra spaces around the comment are removed before it is saved.
- **Confirmed:** Approving takes **no comment**. Cancelling takes **no reason**.
- **Confirmed:** Once a request is Approved, Rejected or Cancelled, it can't be changed, reopened or resubmitted.
- **Confirmed:** The reviewer's comment is visible to anyone who can view the request, including the requester and administrators.
- **Confirmed:** The Cancel, Approve and Reject buttons appear only to the person who is allowed to use them, and only while the request is Submitted. The system also re-checks these rules when the action is attempted.
- **Confirmed:** After an action, the request's details and the list refresh to show the new status.
- **Inference:** Draft → Submitted is the intended path for a new request, but it is not built.
- **Open question:** Should a requester be able to cancel a Draft, or delete it?
- **Open question:** Should approval allow an optional comment? Should cancellation capture a reason?
- **Open question:** Today the only check is "is this person the requester?". Should cancelling also depend on the person still being an employee? The current data never sets this up, so it is untested.

## 7. What users are told when something isn't allowed

When an action or view is refused, nothing is changed and a short message appears in a banner at the top of the page.

| Situation (plain language) | Message shown | Label |
|---|---|---|
| No person is selected. | "Select a current user." | Confirmed |
| The selected person doesn't exist or has been deactivated. | "The selected user is unavailable." | Confirmed |
| The request reference isn't a valid number. | "Request ID must be a number." | Confirmed |
| The request doesn't exist. | "Request not found." | Confirmed |
| The person isn't allowed to view the request. | "You cannot view this request." | Confirmed |
| The person isn't the requester and tries to cancel. | "You cannot cancel this request." | Confirmed |
| The person can't view the request and tries to approve or reject it. | "Request not found." | Confirmed |
| The person can view the request but isn't allowed to decide it (not the assigned reviewer, not a reviewer, or its requester) and tries to approve or reject. | "You cannot decide this request." | Confirmed |
| Cancelling a request that isn't Submitted. | "Only a submitted request can be cancelled." | Confirmed |
| Approving or rejecting a request that isn't Submitted. | "Only a submitted request can be decided." | Confirmed |
| Rejecting without a comment. | "A comment is required to reject a request." | Confirmed |
| Adding a comment with no text. | "Comment text is required." | Confirmed |
| The data sent to the system is malformed. | "The request body contains invalid JSON." | Confirmed |
| Any unexpected failure. | A generic error message. | Confirmed |

- **Confirmed:** Permission checks happen before status checks. Someone who isn't allowed to act on a request is told so, whatever its status.
- **Confirmed:** Approving and rejecting don't reveal requests outside a person's view: they get "Request not found.", the same as for a request that doesn't exist.
- **Inference:** Opening, cancelling or commenting on a request outside your view still says "You cannot view this request" or "You cannot cancel this request", which tells someone the reference exists. The product owner decided to keep this for now (approve/reject spec, Q12).
- **Open question:** Should those cases also look the same as "not found", so that request numbers outside a person's view aren't revealed anywhere?
- **Open question:** The malformed-data message is technical. Should it be reworded for business users? (Normal use of the screens shouldn't trigger it.)

## 8. Workflows not yet implemented

None of the following exists today. Each is an **Open question** about whether and how it should exist. None of them should be assumed.

1. **Creating a request.** Nobody can raise a new request in the application. Every request comes from sample data.
2. **Submitting a Draft** for review.
3. **Editing** a request (title, description, category, priority) at any status.
4. **Assigning or reassigning a reviewer**, including when the reviewer is blank or inactive.
5. **Automatic routing** of requests to reviewers by category or any other rule.
6. **Deleting** requests, including unwanted Drafts.
7. **Reopening or resubmitting** a Rejected or Cancelled request.
8. **Administrator actions** beyond commenting: overriding a decision, cancelling, reassigning or managing data.
9. **Managing people and roles**: adding people, changing roles, deactivating or reactivating.
10. **Managing categories.**
11. **Notifications** (email or in-app) when a request is decided, cancelled or commented on.
12. **History or audit trail**: who did what and when. Only the "Last updated" date and the single approve/reject decision (who and when) are kept.
13. **Fulfilment** after approval: ordering, provisioning, booking.
14. **Use of priority**: deadlines, ordering or escalation.
15. **Search, filtering, sorting and reporting.**
16. **Real sign-in** and protection against acting as someone else.
17. **Attachments** or supporting documents. (One sample rejection asks for an "assessment reference", but nothing lets a requester attach one.)
18. **Editing, deleting or replying to comments.**

## 9. Summary of decisions needed

For quick triage, these are the open questions from above:

- Administrator powers beyond viewing (section 2, section 8).
- Whether reviewers can also be requesters (section 2).
- What happens to requests whose reviewer becomes inactive or is missing (section 2, section 8).
- Real authentication (section 3).
- What priority means (section 4).
- Whether reviewers and administrators should see Drafts (section 5).
- How Drafts are created, submitted, cancelled or deleted (section 6, section 8).
- Comments on approval and reasons for cancellation (section 6).
- Whether refused views should reveal that a request exists (section 7).
- Which items in section 8 are in scope next.
