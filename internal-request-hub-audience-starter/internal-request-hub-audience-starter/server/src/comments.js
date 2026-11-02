import { HttpError } from "./http-errors.js";
import { getVisibleRequest } from "./requests.js";

const commentSelect = `
  SELECT
    c.id,
    c.request_id AS requestId,
    c.author_id AS authorId,
    u.name AS authorName,
    c.body,
    c.created_at AS createdAt
  FROM request_comments c
  JOIN users u ON u.id = c.author_id
`;

export function listComments(db, user, requestId) {
  const request = getVisibleRequest(db, user, requestId);
  return db.prepare(`
    ${commentSelect}
    WHERE c.request_id = ?
    ORDER BY c.created_at ASC, c.id ASC
  `).all(request.id);
}

export function addComment(db, user, requestId, text) {
  const request = getVisibleRequest(db, user, requestId);

  const body = typeof text === "string" ? text.trim() : "";
  if (!body) {
    throw new HttpError(400, "COMMENT_TEXT_REQUIRED", "Comment text is required.");
  }

  const now = new Date().toISOString();
  const { lastInsertRowid } = db.prepare(`
    INSERT INTO request_comments (request_id, author_id, body, created_at) VALUES (?, ?, ?, ?)
  `).run(request.id, user.id, body, now);

  return db.prepare(`${commentSelect} WHERE c.id = ?`).get(lastInsertRowid);
}
