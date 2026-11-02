import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createApp } from "../src/app.js";
import { createDatabase } from "../src/db.js";

let db;
let server;
let baseUrl;

before(async () => {
  db = createDatabase(":memory:");
  // Assignments the app never creates: an admin as assigned reviewer (AR-16)
  // and a reviewer assigned to a request they raised (AR-18).
  const insert = db.prepare(`
    INSERT INTO requests (
      id, title, description, category_id, requester_id, assigned_reviewer_id,
      priority, status, reviewer_comment, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insert.run(
    203, "Admin-assigned fixture", "Test fixture for AR-16.", 1, 2, 5,
    "Low", "Submitted", null, "2026-09-21T09:00:00Z", "2026-09-21T09:00:00Z",
  );
  insert.run(
    205, "Self-assigned fixture", "Test fixture for AR-18.", 1, 3, 3,
    "Low", "Submitted", null, "2026-09-21T09:00:00Z", "2026-09-21T09:00:00Z",
  );

  server = createApp({ db }).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  db.close();
});

async function call(method, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

function errorBody(code, message) {
  return { error: { code, message } };
}

async function storedRequest(id) {
  return (await call("GET", `/api/requests/${id}?currentUserId=5`)).body.data;
}

describe("approve/reject over HTTP", () => {
  // Denials first, while 101 and 103 are still Submitted.

  it("AR-10: tells a reviewer who isn't assigned that the request was not found", async () => {
    const result = await call("POST", "/api/requests/101/approve?currentUserId=4");
    assert.equal(result.status, 404);
    assert.deepEqual(result.body, errorBody("REQUEST_NOT_FOUND", "Request not found."));
  });

  it("AR-12: denies the requester from deciding their own request", async () => {
    const result = await call("POST", "/api/requests/101/approve?currentUserId=1");
    assert.equal(result.status, 403);
    assert.deepEqual(result.body, errorBody("REQUEST_FORBIDDEN", "You cannot decide this request."));
  });

  it("AR-16: denies an administrator who is the assigned reviewer", async () => {
    const result = await call("POST", "/api/requests/203/approve?currentUserId=5");
    assert.equal(result.status, 403);
    assert.deepEqual(result.body, errorBody("REQUEST_FORBIDDEN", "You cannot decide this request."));
  });

  it("AR-18: denies a reviewer deciding a request they raised", async () => {
    const result = await call("POST", "/api/requests/205/reject?currentUserId=3", { comment: "Self-review." });
    assert.equal(result.status, 403);
    assert.deepEqual(result.body, errorBody("REQUEST_FORBIDDEN", "You cannot decide this request."));
  });

  it("AR-20: refuses to decide a request that is not submitted", async () => {
    const result = await call("POST", "/api/requests/102/approve?currentUserId=4");
    assert.equal(result.status, 409);
    assert.deepEqual(
      result.body,
      errorBody("REQUEST_NOT_DECIDABLE", "Only a submitted request can be decided."),
    );
  });

  it("AR-30: requires a non-empty comment to reject", async () => {
    const result = await call("POST", "/api/requests/103/reject?currentUserId=3", { comment: "" });
    assert.equal(result.status, 400);
    assert.deepEqual(
      result.body,
      errorBody("REJECTION_COMMENT_REQUIRED", "A comment is required to reject a request."),
    );
  });

  it("AR-31: refuses a missing request and an invalid ID", async () => {
    const missing = await call("POST", "/api/requests/999/approve?currentUserId=3");
    assert.equal(missing.status, 404);
    assert.deepEqual(missing.body, errorBody("REQUEST_NOT_FOUND", "Request not found."));

    const invalid = await call("POST", "/api/requests/abc/approve?currentUserId=3");
    assert.equal(invalid.status, 400);
    assert.deepEqual(invalid.body, errorBody("INVALID_REQUEST_ID", "Request ID must be a number."));
  });

  it("AR-32: refuses a missing or inactive current user without changing the request", async () => {
    const before = await storedRequest(101);
    for (const action of ["approve", "reject"]) {
      const body = action === "reject" ? { comment: "Comment." } : undefined;

      const missing = await call("POST", `/api/requests/101/${action}`, body);
      assert.equal(missing.status, 400);
      assert.deepEqual(missing.body, errorBody("CURRENT_USER_REQUIRED", "Select a current user."));

      const inactive = await call("POST", `/api/requests/101/${action}?currentUserId=6`, body);
      assert.equal(inactive.status, 401);
      assert.deepEqual(
        inactive.body,
        errorBody("INVALID_CURRENT_USER", "The selected user is unavailable."),
      );
    }
    assert.deepEqual(await storedRequest(101), before);
  });

  it("AR-01: lets the assigned reviewer approve and records the decision", async () => {
    const result = await call("POST", "/api/requests/101/approve?currentUserId=3");
    assert.equal(result.status, 200);
    assert.equal(result.body.data.status, "Approved");
    assert.equal(result.body.data.decidedByName, "Priya Menon");
    assert.equal(result.body.data.decidedAt, result.body.data.updatedAt);

    const stored = await storedRequest(101);
    assert.equal(stored.status, "Approved");
    assert.equal(stored.decidedByName, "Priya Menon");
  });

  it("AR-02: lets the assigned reviewer reject with a comment and records the decision", async () => {
    const result = await call(
      "POST",
      "/api/requests/103/reject?currentUserId=3",
      { comment: "Please add the cost centre." },
    );
    assert.equal(result.status, 200);
    assert.equal(result.body.data.status, "Rejected");
    assert.equal(result.body.data.reviewerComment, "Please add the cost centre.");
    assert.equal(result.body.data.decidedByName, "Priya Menon");
  });
});
