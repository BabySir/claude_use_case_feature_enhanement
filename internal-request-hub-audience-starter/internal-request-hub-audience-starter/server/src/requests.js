import { transaction } from "./db.js";
import { HttpError } from "./http-errors.js";

const requestSelect = `
  SELECT
    r.id,
    r.title,
    r.description,
    r.priority,
    r.status,
    r.reviewer_comment AS reviewerComment,
    r.created_at AS createdAt,
    r.updated_at AS updatedAt,
    c.id AS categoryId,
    c.name AS categoryName,
    requester.id AS requesterId,
    requester.name AS requesterName,
    reviewer.id AS assignedReviewerId,
    reviewer.name AS assignedReviewerName,
    decider.id AS decidedById,
    decider.name AS decidedByName,
    d.decided_at AS decidedAt
  FROM requests r
  JOIN categories c ON c.id = r.category_id
  JOIN users requester ON requester.id = r.requester_id
  LEFT JOIN users reviewer ON reviewer.id = r.assigned_reviewer_id
  LEFT JOIN request_decisions d ON d.request_id = r.id
  LEFT JOIN users decider ON decider.id = d.decided_by_id
`;

export function listVisibleRequests(db, user) {
  const visibility = visibilityClause(user);
  return db.prepare(`
    ${requestSelect}
    WHERE ${visibility.sql}
    ORDER BY r.created_at DESC, r.id DESC
  `).all(...visibility.params);
}

export function getVisibleRequest(db, user, requestId) {
  const id = Number(requestId);
  if (!Number.isInteger(id)) {
    throw new HttpError(400, "INVALID_REQUEST_ID", "Request ID must be a number.");
  }

  const request = db.prepare(`${requestSelect} WHERE r.id = ?`).get(id);
  if (!request) {
    throw new HttpError(404, "REQUEST_NOT_FOUND", "Request not found.");
  }

  if (!canViewRequest(user, request)) {
    throw new HttpError(403, "REQUEST_FORBIDDEN", "You cannot view this request.");
  }

  return request;
}

export function canViewRequest(user, request) {
  return user.role === "admin"
    || (user.role === "employee" && request.requesterId === user.id)
    || (user.role === "reviewer" && request.assignedReviewerId === user.id);
}

function loadDecidableRequest(db, user, requestId) {
  const id = Number(requestId);
  if (!Number.isInteger(id)) {
    throw new HttpError(400, "INVALID_REQUEST_ID", "Request ID must be a number.");
  }

  // A user who cannot view the request is told it does not exist (spec R8).
  const request = db.prepare(`${requestSelect} WHERE r.id = ?`).get(id);
  if (!request || !canViewRequest(user, request)) {
    throw new HttpError(404, "REQUEST_NOT_FOUND", "Request not found.");
  }

  if (
    request.assignedReviewerId !== user.id
    || user.role !== "reviewer"
    || request.requesterId === user.id
  ) {
    throw new HttpError(403, "REQUEST_FORBIDDEN", "You cannot decide this request.");
  }

  if (request.status !== "Submitted") {
    throw new HttpError(409, "REQUEST_NOT_DECIDABLE", "Only a submitted request can be decided.");
  }

  return id;
}

export function approveRequest(db, user, requestId) {
  const id = loadDecidableRequest(db, user, requestId);

  const now = new Date().toISOString();
  transaction(db, () => {
    db.prepare(`UPDATE requests SET status = 'Approved', updated_at = ? WHERE id = ?`).run(now, id);
    recordDecision(db, id, user.id, now);
  });

  return db.prepare(`${requestSelect} WHERE r.id = ?`).get(id);
}

export function rejectRequest(db, user, requestId, comment) {
  const id = loadDecidableRequest(db, user, requestId);

  const trimmedComment = typeof comment === "string" ? comment.trim() : "";
  if (!trimmedComment) {
    throw new HttpError(400, "REJECTION_COMMENT_REQUIRED", "A comment is required to reject a request.");
  }

  const now = new Date().toISOString();
  transaction(db, () => {
    db.prepare(`
      UPDATE requests SET status = 'Rejected', reviewer_comment = ?, updated_at = ? WHERE id = ?
    `).run(trimmedComment, now, id);
    recordDecision(db, id, user.id, now);
  });

  return db.prepare(`${requestSelect} WHERE r.id = ?`).get(id);
}

function recordDecision(db, requestId, userId, decidedAt) {
  db.prepare(`
    INSERT INTO request_decisions (request_id, decided_by_id, decided_at) VALUES (?, ?, ?)
  `).run(requestId, userId, decidedAt);
}

export function cancelRequest(db, user, requestId) {
  const id = Number(requestId);
  if (!Number.isInteger(id)) {
    throw new HttpError(400, "INVALID_REQUEST_ID", "Request ID must be a number.");
  }

  const request = db.prepare(`${requestSelect} WHERE r.id = ?`).get(id);
  if (!request) {
    throw new HttpError(404, "REQUEST_NOT_FOUND", "Request not found.");
  }

  if (request.requesterId !== user.id) {
    throw new HttpError(403, "REQUEST_FORBIDDEN", "You cannot cancel this request.");
  }

  if (request.status !== "Submitted") {
    throw new HttpError(409, "REQUEST_NOT_CANCELLABLE", "Only a submitted request can be cancelled.");
  }

  const now = new Date().toISOString();
  db.prepare(`UPDATE requests SET status = 'Cancelled', updated_at = ? WHERE id = ?`).run(now, id);

  return db.prepare(`${requestSelect} WHERE r.id = ?`).get(id);
}

function visibilityClause(user) {
  if (user.role === "admin") return { sql: "1 = 1", params: [] };
  if (user.role === "reviewer") {
    return { sql: "r.assigned_reviewer_id = ?", params: [user.id] };
  }
  return { sql: "r.requester_id = ?", params: [user.id] };
}
