import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createApp } from "../src/app.js";
import { createDatabase } from "../src/db.js";

let db;
let server;
let baseUrl;

before(async () => {
  db = createDatabase(":memory:");
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

describe("comments over HTTP", () => {
  it("lists no comments for a request without any", async () => {
    const result = await call("GET", "/api/requests/101/comments?currentUserId=1");
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { data: [] });
  });

  it("CMT-01: adds a comment with 201 and lists it afterwards", async () => {
    const created = await call("POST", "/api/requests/101/comments?currentUserId=1", { text: "Any update?" });
    assert.equal(created.status, 201);
    assert.equal(created.body.data.body, "Any update?");
    assert.equal(created.body.data.authorName, "Maya Nair");

    const listed = await call("GET", "/api/requests/101/comments?currentUserId=3");
    assert.equal(listed.status, 200);
    assert.deepEqual(listed.body.data.map((comment) => comment.id), [created.body.data.id]);
  });

  it("CMT-08: refuses a missing or inactive current user", async () => {
    for (const method of ["GET", "POST"]) {
      const body = method === "POST" ? { text: "Hello." } : undefined;

      const missing = await call(method, "/api/requests/101/comments", body);
      assert.equal(missing.status, 400);
      assert.equal(missing.body.error.code, "CURRENT_USER_REQUIRED");

      const inactive = await call(method, "/api/requests/101/comments?currentUserId=6", body);
      assert.equal(inactive.status, 401);
      assert.equal(inactive.body.error.code, "INVALID_CURRENT_USER");
    }
  });

  it("CMT-07: refuses a non-numeric request ID", async () => {
    const result = await call("GET", "/api/requests/abc/comments?currentUserId=1");
    assert.equal(result.status, 400);
    assert.equal(result.body.error.code, "INVALID_REQUEST_ID");
  });

  it("CMT-10/11/12: refuses empty, whitespace-only and missing text", async () => {
    for (const body of [{ text: "" }, { text: "   " }, {}, undefined]) {
      const result = await call("POST", "/api/requests/101/comments?currentUserId=1", body);
      assert.equal(result.status, 400);
      assert.deepEqual(result.body, {
        error: { code: "COMMENT_TEXT_REQUIRED", message: "Comment text is required." },
      });
    }
  });

  it("CMT-04/21: refuses a user who cannot view the request, without returning comments", async () => {
    const listed = await call("GET", "/api/requests/101/comments?currentUserId=2");
    assert.equal(listed.status, 403);
    assert.equal(listed.body.error.code, "REQUEST_FORBIDDEN");
    assert.equal(listed.body.data, undefined);

    const created = await call("POST", "/api/requests/101/comments?currentUserId=2", { text: "Hello." });
    assert.equal(created.status, 403);
    assert.equal(created.body.error.code, "REQUEST_FORBIDDEN");
  });
});
