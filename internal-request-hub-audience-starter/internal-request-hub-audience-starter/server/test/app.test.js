import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { addComment, listComments } from "../src/comments.js";
import { getCurrentUser } from "../src/current-user.js";
import { createDatabase } from "../src/db.js";
import {
  approveRequest,
  cancelRequest,
  getVisibleRequest,
  listVisibleRequests,
  rejectRequest,
} from "../src/requests.js";

let db;

before(() => {
  db = createDatabase(":memory:");
});

after(() => {
  db.close();
});

describe("current user", () => {
  it("loads an active user", () => {
    assert.deepEqual(getCurrentUser(db, 1), {
      id: 1,
      name: "Maya Nair",
      email: "maya.nair@example.test",
      role: "employee",
      active: true,
    });
  });

  it("requires a selected user", () => {
    assert.throws(
      () => getCurrentUser(db),
      (error) => error.status === 400 && error.code === "CURRENT_USER_REQUIRED",
    );
  });
});

describe("request visibility", () => {
  it("shows an employee only their requests", () => {
    const requests = listVisibleRequests(db, getCurrentUser(db, 1));

    assert.deepEqual(requests.map((request) => request.id), [105, 101, 102]);
    assert.ok(requests.every((request) => request.requesterId === 1));
  });

  it("shows a reviewer only assigned requests", () => {
    const requests = listVisibleRequests(db, getCurrentUser(db, 3));

    assert.deepEqual(requests.map((request) => request.id), [103, 101]);
    assert.ok(requests.every((request) => request.assignedReviewerId === 3));
  });

  it("shows an administrator all requests", () => {
    const requests = listVisibleRequests(db, getCurrentUser(db, 5));

    assert.equal(requests.length, 5);
  });

  it("rejects a request outside the user's view", () => {
    assert.throws(
      () => getVisibleRequest(db, getCurrentUser(db, 1), 103),
      (error) => error.status === 403 && error.code === "REQUEST_FORBIDDEN",
    );
  });
});

describe("cancel request", () => {
  // These tests intentionally run in order: denials first, while request
  // 101 is still Submitted, then the success case (which cancels 101),
  // then the already-cancelled rejection reuses that same mutation.

  it("denies a different employee from cancelling a submitted request", () => {
    const before = snapshot(101);
    assert.throws(
      () => cancelRequest(db, getCurrentUser(db, 2), 101),
      (error) => error.status === 403 && error.code === "REQUEST_FORBIDDEN",
    );
    assert.deepEqual(snapshot(101), before);
  });

  it("denies the assigned reviewer from cancelling a submitted request", () => {
    const before = snapshot(101);
    assert.throws(
      () => cancelRequest(db, getCurrentUser(db, 3), 101),
      (error) => error.status === 403 && error.code === "REQUEST_FORBIDDEN",
    );
    assert.deepEqual(snapshot(101), before);
  });

  it("denies an administrator from cancelling on the requester's behalf", () => {
    const before = snapshot(101);
    assert.throws(
      () => cancelRequest(db, getCurrentUser(db, 5), 101),
      (error) => error.status === 403 && error.code === "REQUEST_FORBIDDEN",
    );
    assert.deepEqual(snapshot(101), before);
  });

  it("lets the requester cancel their own submitted request", () => {
    const result = cancelRequest(db, getCurrentUser(db, 1), 101);
    assert.equal(result.status, "Cancelled");
    assert.equal(snapshot(101).status, "Cancelled");
  });

  it("rejects cancelling a request that is already cancelled", () => {
    const before = snapshot(101);
    assert.throws(
      () => cancelRequest(db, getCurrentUser(db, 1), 101),
      (error) => error.status === 409 && error.code === "REQUEST_NOT_CANCELLABLE",
    );
    assert.deepEqual(snapshot(101), before);
  });

  it("rejects cancelling a draft request", () => {
    const before = snapshot(105);
    assert.throws(
      () => cancelRequest(db, getCurrentUser(db, 1), 105),
      (error) => error.status === 409 && error.code === "REQUEST_NOT_CANCELLABLE",
    );
    assert.deepEqual(snapshot(105), before);
  });

  it("rejects cancelling an approved request", () => {
    const before = snapshot(102);
    assert.throws(
      () => cancelRequest(db, getCurrentUser(db, 1), 102),
      (error) => error.status === 409 && error.code === "REQUEST_NOT_CANCELLABLE",
    );
    assert.deepEqual(snapshot(102), before);
  });

  it("rejects cancelling a rejected request", () => {
    const before = snapshot(104);
    assert.throws(
      () => cancelRequest(db, getCurrentUser(db, 2), 104),
      (error) => error.status === 409 && error.code === "REQUEST_NOT_CANCELLABLE",
    );
    assert.deepEqual(snapshot(104), before);
  });

  it("rejects cancelling a request that does not exist", () => {
    assert.throws(
      () => cancelRequest(db, getCurrentUser(db, 1), 999),
      (error) => error.status === 404 && error.code === "REQUEST_NOT_FOUND",
    );
  });
});

describe("approve/reject request", () => {
  // Test-only fixtures, scoped to this describe block only (never added to
  // server/src/db.js's seed data): ids outside the seeded 101-105 range so
  // they can't collide with or shift the other describe blocks' fixtures
  // or counts. 201 covers the approve-success path (the only other
  // Submitted seed row, 103, is reserved below for the denial checks and
  // the reject-success path). 202 covers AC-7's Draft case, since no seed
  // row is both Draft and has a non-null assigned reviewer. 203-205 cover
  // assignments the app itself never creates: an admin (AR-16) or an
  // employee (AR-17) as assigned reviewer, and a reviewer assigned to their
  // own request (AR-18).
  before(() => {
    const insert = db.prepare(`
      INSERT INTO requests (
        id, title, description, category_id, requester_id, assigned_reviewer_id,
        priority, status, reviewer_comment, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insert.run(
      201, "Standing desk", "Test fixture for approve-success.", 1, 1, 3,
      "Low", "Submitted", null, "2026-09-21T09:00:00Z", "2026-09-21T09:00:00Z",
    );
    insert.run(
      202, "Draft fixture", "Test fixture for the Draft-with-reviewer AC-7 case.", 1, 1, 3,
      "Low", "Draft", null, "2026-09-21T09:00:00Z", "2026-09-21T09:00:00Z",
    );
    insert.run(
      203, "Admin-assigned fixture", "Test fixture for AR-16.", 1, 2, 5,
      "Low", "Submitted", null, "2026-09-21T09:00:00Z", "2026-09-21T09:00:00Z",
    );
    insert.run(
      204, "Employee-assigned fixture", "Test fixture for AR-17.", 1, 2, 1,
      "Low", "Submitted", null, "2026-09-21T09:00:00Z", "2026-09-21T09:00:00Z",
    );
    insert.run(
      205, "Self-assigned fixture", "Test fixture for AR-18.", 1, 3, 3,
      "Low", "Submitted", null, "2026-09-21T09:00:00Z", "2026-09-21T09:00:00Z",
    );
  });

  // Denials run first, while 103 is still Submitted.

  it("AR-10/11: tells a reviewer who isn't assigned that the request was not found", () => {
    const before = state(103);
    assert.throws(
      () => approveRequest(db, getCurrentUser(db, 4), 103),
      (error) => error.status === 404 && error.code === "REQUEST_NOT_FOUND",
    );
    assert.throws(
      () => rejectRequest(db, getCurrentUser(db, 4), 103, "Not mine."),
      (error) => error.status === 404 && error.code === "REQUEST_NOT_FOUND",
    );
    assert.deepEqual(state(103), before);
  });

  it("AR-12: denies the requester from deciding their own request", () => {
    const before = state(103);
    assert.throws(
      () => approveRequest(db, getCurrentUser(db, 2), 103),
      (error) => error.status === 403 && error.code === "REQUEST_FORBIDDEN",
    );
    assert.throws(
      () => rejectRequest(db, getCurrentUser(db, 2), 103, "Self-review."),
      (error) => error.status === 403 && error.code === "REQUEST_FORBIDDEN",
    );
    assert.deepEqual(state(103), before);
  });

  it("AR-13: tells an employee who can't view the request that it was not found", () => {
    const before = state(103);
    assert.throws(
      () => approveRequest(db, getCurrentUser(db, 1), 103),
      (error) => error.status === 404 && error.code === "REQUEST_NOT_FOUND",
    );
    assert.throws(
      () => rejectRequest(db, getCurrentUser(db, 1), 103, "Not mine."),
      (error) => error.status === 404 && error.code === "REQUEST_NOT_FOUND",
    );
    assert.deepEqual(state(103), before);
  });

  it("AR-14/15: denies an administrator from deciding on the assigned reviewer's behalf", () => {
    const before = state(103);
    assert.throws(
      () => approveRequest(db, getCurrentUser(db, 5), 103),
      (error) => error.status === 403 && error.code === "REQUEST_FORBIDDEN",
    );
    assert.throws(
      () => rejectRequest(db, getCurrentUser(db, 5), 103, "Admin override attempt."),
      (error) => error.status === 403 && error.code === "REQUEST_FORBIDDEN",
    );
    assert.deepEqual(state(103), before);
  });

  it("AR-16: denies an administrator who is the assigned reviewer (role rule)", () => {
    const before = state(203);
    assert.throws(
      () => approveRequest(db, getCurrentUser(db, 5), 203),
      (error) => error.status === 403 && error.code === "REQUEST_FORBIDDEN",
    );
    assert.throws(
      () => rejectRequest(db, getCurrentUser(db, 5), 203, "Admin decision."),
      (error) => error.status === 403 && error.code === "REQUEST_FORBIDDEN",
    );
    assert.deepEqual(state(203), before);
  });

  it("AR-17: tells an assigned employee who can't view the request that it was not found", () => {
    const before = state(204);
    assert.throws(
      () => approveRequest(db, getCurrentUser(db, 1), 204),
      (error) => error.status === 404 && error.code === "REQUEST_NOT_FOUND",
    );
    assert.deepEqual(state(204), before);
  });

  it("AR-18: denies a reviewer deciding a request they raised", () => {
    const before = state(205);
    assert.throws(
      () => approveRequest(db, getCurrentUser(db, 3), 205),
      (error) => error.status === 403 && error.code === "REQUEST_FORBIDDEN",
    );
    assert.throws(
      () => rejectRequest(db, getCurrentUser(db, 3), 205, "Self-review."),
      (error) => error.status === 403 && error.code === "REQUEST_FORBIDDEN",
    );
    assert.deepEqual(state(205), before);
  });

  it("AR-40/41: checks who may decide before the request's status", () => {
    const before = state(102);
    assert.throws(
      () => approveRequest(db, getCurrentUser(db, 3), 102),
      (error) => error.status === 404 && error.code === "REQUEST_NOT_FOUND",
    );
    assert.throws(
      () => approveRequest(db, getCurrentUser(db, 5), 102),
      (error) => error.status === 403 && error.code === "REQUEST_FORBIDDEN",
    );
    assert.deepEqual(state(102), before);
  });

  it("AR-42: checks who may decide before the rejection comment", () => {
    const before = state(103);
    assert.throws(
      () => rejectRequest(db, getCurrentUser(db, 5), 103, ""),
      (error) => error.status === 403 && error.code === "REQUEST_FORBIDDEN",
    );
    assert.deepEqual(state(103), before);
  });

  it("AR-30: requires a non-empty comment to reject", () => {
    const before = state(103);
    for (const comment of ["", "   ", undefined]) {
      assert.throws(
        () => rejectRequest(db, getCurrentUser(db, 3), 103, comment),
        (error) => error.status === 400 && error.code === "REJECTION_COMMENT_REQUIRED",
      );
    }
    assert.deepEqual(state(103), before);
  });

  it("AR-02/03: lets the assigned reviewer reject a submitted request with a comment", () => {
    const result = rejectRequest(db, getCurrentUser(db, 3), 103, "  Needs more detail.  ");
    assert.equal(result.status, "Rejected");
    assert.equal(result.reviewerComment, "Needs more detail.");
    assert.equal(result.decidedById, 3);
    assert.equal(result.decidedByName, "Priya Menon");
    assert.equal(result.decidedAt, result.updatedAt);
    assert.equal(snapshot(103).status, "Rejected");
    assert.equal(snapshot(103).reviewer_comment, "Needs more detail.");
    assert.deepEqual(
      { ...decisionSnapshot(103) },
      { request_id: 103, decided_by_id: 3, decided_at: result.decidedAt },
    );
  });

  it("AR-01: lets the assigned reviewer approve a submitted request", () => {
    const result = approveRequest(db, getCurrentUser(db, 3), 201);
    assert.equal(result.status, "Approved");
    assert.equal(result.decidedById, 3);
    assert.equal(result.decidedByName, "Priya Menon");
    assert.ok(!Number.isNaN(Date.parse(result.decidedAt)));
    assert.equal(result.decidedAt, result.updatedAt);
    assert.equal(snapshot(201).status, "Approved");
    assert.deepEqual(
      { ...decisionSnapshot(201) },
      { request_id: 201, decided_by_id: 3, decided_at: result.decidedAt },
    );
  });

  it("rejects deciding a request that is already rejected", () => {
    const before = state(103);
    assert.throws(
      () => approveRequest(db, getCurrentUser(db, 3), 103),
      (error) => error.status === 409 && error.code === "REQUEST_NOT_DECIDABLE",
    );
    assert.deepEqual(state(103), before);
  });

  it("AR-20: rejects deciding an approved request", () => {
    const before = state(102);
    assert.throws(
      () => approveRequest(db, getCurrentUser(db, 4), 102),
      (error) => error.status === 409 && error.code === "REQUEST_NOT_DECIDABLE",
    );
    assert.deepEqual(state(102), before);
  });

  it("AR-21: rejects deciding an already-rejected request", () => {
    const before = state(104);
    assert.throws(
      () => rejectRequest(db, getCurrentUser(db, 4), 104, "Another comment."),
      (error) => error.status === 409 && error.code === "REQUEST_NOT_DECIDABLE",
    );
    assert.deepEqual(state(104), before);
  });

  it("AR-22: rejects deciding a cancelled request", () => {
    const before = state(101);
    assert.equal(before.request.status, "Cancelled");
    assert.throws(
      () => approveRequest(db, getCurrentUser(db, 3), 101),
      (error) => error.status === 409 && error.code === "REQUEST_NOT_DECIDABLE",
    );
    assert.deepEqual(state(101), before);
  });

  it("AR-23: rejects deciding a draft request", () => {
    const before = state(202);
    assert.throws(
      () => approveRequest(db, getCurrentUser(db, 3), 202),
      (error) => error.status === 409 && error.code === "REQUEST_NOT_DECIDABLE",
    );
    assert.deepEqual(state(202), before);
  });

  it("AR-31: rejects deciding a request that does not exist or has an invalid ID", () => {
    assert.throws(
      () => approveRequest(db, getCurrentUser(db, 3), 999),
      (error) => error.status === 404 && error.code === "REQUEST_NOT_FOUND",
    );
    assert.throws(
      () => rejectRequest(db, getCurrentUser(db, 3), 999, "Comment."),
      (error) => error.status === 404 && error.code === "REQUEST_NOT_FOUND",
    );
    assert.throws(
      () => approveRequest(db, getCurrentUser(db, 3), "abc"),
      (error) => error.status === 400 && error.code === "INVALID_REQUEST_ID",
    );
  });
});

describe("comments", () => {
  // Runs last: by now 101 is Cancelled and 103 is Rejected, so test-only
  // fixtures 301 and 302 stand in for the spec's Submitted request 101.
  // 104 is still in its seeded Rejected state.
  before(() => {
    const insert = db.prepare(`
      INSERT INTO requests (
        id, title, description, category_id, requester_id, assigned_reviewer_id,
        priority, status, reviewer_comment, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insert.run(
      301, "Comment fixture", "Test fixture for comment rules.", 1, 1, 3,
      "Medium", "Submitted", null, "2026-09-22T09:00:00Z", "2026-09-22T09:00:00Z",
    );
    insert.run(
      302, "Comment then decide fixture", "Test fixture for CMT-31 and CMT-41.", 1, 1, 3,
      "Low", "Submitted", null, "2026-09-22T09:00:00Z", "2026-09-22T09:00:00Z",
    );
  });

  it("CMT-10/11/12: refuses empty, whitespace-only and missing text", () => {
    for (const text of ["", "   \n\t", undefined]) {
      assert.throws(
        () => addComment(db, getCurrentUser(db, 1), 301, text),
        (error) => error.status === 400 && error.code === "COMMENT_TEXT_REQUIRED"
          && error.message === "Comment text is required.",
      );
    }
    assert.equal(commentCount(301), 0);
  });

  it("CMT-04/05: refuses users who cannot view the request", () => {
    for (const userId of [2, 4]) {
      assert.throws(
        () => addComment(db, getCurrentUser(db, userId), 301, "Not allowed."),
        (error) => error.status === 403 && error.code === "REQUEST_FORBIDDEN",
      );
    }
    assert.equal(commentCount(301), 0);
  });

  it("CMT-06: refuses a request that does not exist", () => {
    assert.throws(
      () => addComment(db, getCurrentUser(db, 1), 999, "Hello."),
      (error) => error.status === 404 && error.code === "REQUEST_NOT_FOUND",
    );
    assert.throws(
      () => listComments(db, getCurrentUser(db, 1), 999),
      (error) => error.status === 404 && error.code === "REQUEST_NOT_FOUND",
    );
  });

  it("CMT-07: refuses a non-numeric request ID", () => {
    assert.throws(
      () => addComment(db, getCurrentUser(db, 1), "abc", "Hello."),
      (error) => error.status === 400 && error.code === "INVALID_REQUEST_ID",
    );
    assert.throws(
      () => listComments(db, getCurrentUser(db, 1), "abc"),
      (error) => error.status === 400 && error.code === "INVALID_REQUEST_ID",
    );
  });

  it("CMT-01/40: lets the requester comment without changing the request", () => {
    const before = snapshot(301);
    const comment = addComment(db, getCurrentUser(db, 1), 301, "  Any update on delivery?  ");

    assert.equal(comment.requestId, 301);
    assert.equal(comment.authorId, 1);
    assert.equal(comment.authorName, "Maya Nair");
    assert.equal(comment.body, "Any update on delivery?");
    assert.ok(!Number.isNaN(Date.parse(comment.createdAt)));
    assert.deepEqual(snapshot(301), before);
  });

  it("CMT-02: lets the assigned reviewer comment", () => {
    const comment = addComment(db, getCurrentUser(db, 3), 301, "Checking with the supplier.");
    assert.equal(comment.authorName, "Priya Menon");
  });

  it("CMT-20/30: shows every viewer all comments, oldest first", () => {
    for (const userId of [1, 3, 5]) {
      const comments = listComments(db, getCurrentUser(db, userId), 301);
      assert.deepEqual(comments.map((comment) => comment.authorName), ["Maya Nair", "Priya Menon"]);
    }
  });

  it("CMT-21: refuses to list comments to users who cannot view the request", () => {
    for (const userId of [2, 4]) {
      assert.throws(
        () => listComments(db, getCurrentUser(db, userId), 301),
        (error) => error.status === 403 && error.code === "REQUEST_FORBIDDEN",
      );
    }
  });

  it("CMT-03: lets an administrator comment", () => {
    const comment = addComment(db, getCurrentUser(db, 5), 103, "Noted for the training budget.");
    assert.equal(comment.authorName, "Alex Thomas");
  });

  it("CMT-31: orders by timestamp, then by insertion for ties", () => {
    const insert = db.prepare(`
      INSERT INTO request_comments (request_id, author_id, body, created_at) VALUES (?, ?, ?, ?)
    `);
    insert.run(302, 1, "Later", "2026-09-23T10:00:00.000Z");
    insert.run(302, 1, "Tie first", "2026-09-23T09:00:00.000Z");
    insert.run(302, 3, "Tie second", "2026-09-23T09:00:00.000Z");

    const comments = listComments(db, getCurrentUser(db, 1), 302);
    assert.deepEqual(comments.map((comment) => comment.body), ["Tie first", "Tie second", "Later"]);
  });

  it("CMT-41: still lets the reviewer decide a request that has comments", () => {
    addComment(db, getCurrentUser(db, 1), 302, "Please decide by Friday.");
    const result = approveRequest(db, getCurrentUser(db, 3), 302);
    assert.equal(result.status, "Approved");
    assert.equal(listComments(db, getCurrentUser(db, 3), 302).length, 4);
  });

  it("CMT-42: keeps a rejected request's status and reviewer comment", () => {
    const before = snapshot(104);
    addComment(db, getCurrentUser(db, 2), 104, "Assessment reference attached separately.");
    assert.deepEqual(snapshot(104), before);
    assert.equal(snapshot(104).reviewer_comment, "Please attach the workplace assessment reference.");
  });
});

function snapshot(id) {
  return db.prepare("SELECT * FROM requests WHERE id = ?").get(id);
}

function commentCount(requestId) {
  return db.prepare("SELECT COUNT(*) AS count FROM request_comments WHERE request_id = ?")
    .get(requestId).count;
}

function decisionSnapshot(requestId) {
  return db.prepare("SELECT * FROM request_decisions WHERE request_id = ?").get(requestId);
}

function state(requestId) {
  return { request: snapshot(requestId), decision: decisionSnapshot(requestId) };
}
