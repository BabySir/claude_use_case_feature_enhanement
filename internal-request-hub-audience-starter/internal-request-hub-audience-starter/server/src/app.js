import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { addComment, listComments } from "./comments.js";
import { getCurrentUser } from "./current-user.js";
import { errorResponse } from "./http-errors.js";
import {
  approveRequest,
  cancelRequest,
  getVisibleRequest,
  listVisibleRequests,
  rejectRequest,
} from "./requests.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(currentDir, "../../client/dist");

/**
 * @openapi
 * components:
 *   parameters:
 *     CurrentUserId:
 *       name: currentUserId
 *       in: query
 *       required: true
 *       description: Simulated identity. The id of the active user the request is made as; the server trusts it.
 *       schema:
 *         type: integer
 *     RequestId:
 *       name: id
 *       in: path
 *       required: true
 *       description: Request id. A non-integer value is rejected with 400 INVALID_REQUEST_ID.
 *       schema:
 *         type: string
 *   schemas:
 *     Error:
 *       type: object
 *       required: [error]
 *       properties:
 *         error:
 *           type: object
 *           required: [code, message]
 *           properties:
 *             code:
 *               type: string
 *               example: REQUEST_NOT_FOUND
 *             message:
 *               type: string
 *               example: Request not found.
 *     User:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         name: { type: string }
 *         email: { type: string }
 *         role: { type: string, enum: [employee, reviewer, admin] }
 *     CurrentUser:
 *       allOf:
 *         - $ref: '#/components/schemas/User'
 *         - type: object
 *           properties:
 *             active: { type: boolean }
 *     Category:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         name: { type: string }
 *     Request:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         title: { type: string }
 *         description: { type: string }
 *         priority: { type: string, enum: [Low, Medium, High] }
 *         status: { type: string, enum: [Draft, Submitted, Approved, Rejected, Cancelled] }
 *         reviewerComment: { type: string, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *         categoryId: { type: integer }
 *         categoryName: { type: string }
 *         requesterId: { type: integer }
 *         requesterName: { type: string }
 *         assignedReviewerId: { type: integer, nullable: true }
 *         assignedReviewerName: { type: string, nullable: true }
 *         decidedById: { type: integer, nullable: true }
 *         decidedByName: { type: string, nullable: true }
 *         decidedAt: { type: string, format: date-time, nullable: true }
 *     Comment:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         requestId: { type: integer }
 *         authorId: { type: integer }
 *         authorName: { type: string }
 *         body: { type: string }
 *         createdAt: { type: string, format: date-time }
 *   responses:
 *     BadRequest:
 *       description: Missing or non-integer currentUserId (CURRENT_USER_REQUIRED) or non-integer request id (INVALID_REQUEST_ID).
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Error' }
 *     Unauthorized:
 *       description: The current user does not exist or is inactive (INVALID_CURRENT_USER).
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Error' }
 *     Forbidden:
 *       description: The current user may not perform this action (REQUEST_FORBIDDEN).
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Error' }
 *     NotFound:
 *       description: The request does not exist (REQUEST_NOT_FOUND).
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Error' }
 */

export function createApp({ db }) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  /**
   * @openapi
   * /api/health:
   *   get:
   *     summary: Health check
   *     tags: [System]
   *     responses:
   *       200:
   *         description: The API is running.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status: { type: string, example: ok }
   */
  app.get("/api/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  /**
   * @openapi
   * /api/users:
   *   get:
   *     summary: List active users
   *     description: Active users ordered employees, then reviewers, then admins, then by name. Requires no identity.
   *     tags: [Users]
   *     responses:
   *       200:
   *         description: Active users.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: array
   *                   items: { $ref: '#/components/schemas/User' }
   */
  app.get("/api/users", (_request, response) => {
    const users = db.prepare(`
      SELECT id, name, email, role
      FROM users
      WHERE active = 1
      ORDER BY
        CASE role WHEN 'employee' THEN 1 WHEN 'reviewer' THEN 2 ELSE 3 END,
        name
    `).all();
    response.json({ data: users });
  });

  /**
   * @openapi
   * /api/categories:
   *   get:
   *     summary: List categories
   *     description: All categories ordered by name. Requires no identity.
   *     tags: [Categories]
   *     responses:
   *       200:
   *         description: Categories.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: array
   *                   items: { $ref: '#/components/schemas/Category' }
   */
  app.get("/api/categories", (_request, response) => {
    const categories = db.prepare("SELECT id, name FROM categories ORDER BY name").all();
    response.json({ data: categories });
  });

  /**
   * @openapi
   * /api/requests:
   *   get:
   *     summary: List requests visible to the current user
   *     description: Admins see all requests, reviewers see requests assigned to them, employees see requests they raised. Newest first.
   *     tags: [Requests]
   *     parameters:
   *       - $ref: '#/components/parameters/CurrentUserId'
   *     responses:
   *       200:
   *         description: Visible requests and the resolved current user.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: array
   *                   items: { $ref: '#/components/schemas/Request' }
   *                 meta:
   *                   type: object
   *                   properties:
   *                     currentUser: { $ref: '#/components/schemas/CurrentUser' }
   *       400:
   *         description: Missing or non-integer currentUserId (CURRENT_USER_REQUIRED).
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/Error' }
   *       401: { $ref: '#/components/responses/Unauthorized' }
   */
  app.get("/api/requests", (request, response, next) => {
    try {
      const user = getCurrentUser(db, request.query.currentUserId);
      response.json({ data: listVisibleRequests(db, user), meta: { currentUser: user } });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @openapi
   * /api/requests/{id}:
   *   get:
   *     summary: Get one request
   *     tags: [Requests]
   *     parameters:
   *       - $ref: '#/components/parameters/RequestId'
   *       - $ref: '#/components/parameters/CurrentUserId'
   *     responses:
   *       200:
   *         description: The request.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data: { $ref: '#/components/schemas/Request' }
   *       400: { $ref: '#/components/responses/BadRequest' }
   *       401: { $ref: '#/components/responses/Unauthorized' }
   *       403:
   *         description: The current user cannot view this request (REQUEST_FORBIDDEN, "You cannot view this request.").
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/Error' }
   *       404: { $ref: '#/components/responses/NotFound' }
   */
  app.get("/api/requests/:id", (request, response, next) => {
    try {
      const user = getCurrentUser(db, request.query.currentUserId);
      response.json({ data: getVisibleRequest(db, user, request.params.id) });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @openapi
   * /api/requests/{id}/cancel:
   *   post:
   *     summary: Cancel a submitted request
   *     description: Only the requester can cancel, and only while the request is Submitted.
   *     tags: [Requests]
   *     parameters:
   *       - $ref: '#/components/parameters/RequestId'
   *       - $ref: '#/components/parameters/CurrentUserId'
   *     responses:
   *       200:
   *         description: The cancelled request.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data: { $ref: '#/components/schemas/Request' }
   *       400: { $ref: '#/components/responses/BadRequest' }
   *       401: { $ref: '#/components/responses/Unauthorized' }
   *       403:
   *         description: The current user is not the requester (REQUEST_FORBIDDEN, "You cannot cancel this request.").
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/Error' }
   *       404: { $ref: '#/components/responses/NotFound' }
   *       409:
   *         description: The request is not Submitted (REQUEST_NOT_CANCELLABLE).
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/Error' }
   */
  app.post("/api/requests/:id/cancel", (request, response, next) => {
    try {
      const user = getCurrentUser(db, request.query.currentUserId);
      response.json({ data: cancelRequest(db, user, request.params.id) });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @openapi
   * /api/requests/{id}/approve:
   *   post:
   *     summary: Approve a submitted request
   *     description: Only the assigned reviewer, with the reviewer role and not the requester, can approve, and only while the request is Submitted. Records who decided and when.
   *     tags: [Requests]
   *     parameters:
   *       - $ref: '#/components/parameters/RequestId'
   *       - $ref: '#/components/parameters/CurrentUserId'
   *     responses:
   *       200:
   *         description: The approved request, including decidedById, decidedByName and decidedAt.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data: { $ref: '#/components/schemas/Request' }
   *       400: { $ref: '#/components/responses/BadRequest' }
   *       401: { $ref: '#/components/responses/Unauthorized' }
   *       403:
   *         description: The current user can view the request but may not decide it (REQUEST_FORBIDDEN, "You cannot decide this request.").
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/Error' }
   *       404:
   *         description: The request does not exist or the current user cannot view it (REQUEST_NOT_FOUND).
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/Error' }
   *       409:
   *         description: The request is not Submitted (REQUEST_NOT_DECIDABLE).
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/Error' }
   */
  app.post("/api/requests/:id/approve", (request, response, next) => {
    try {
      const user = getCurrentUser(db, request.query.currentUserId);
      response.json({ data: approveRequest(db, user, request.params.id) });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @openapi
   * /api/requests/{id}/reject:
   *   post:
   *     summary: Reject a submitted request with a comment
   *     description: Same permission and status rules as approve. The comment is trimmed and must not be empty. Records who decided and when.
   *     tags: [Requests]
   *     parameters:
   *       - $ref: '#/components/parameters/RequestId'
   *       - $ref: '#/components/parameters/CurrentUserId'
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               comment: { type: string }
   *     responses:
   *       200:
   *         description: The rejected request, including reviewerComment and the decision fields.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data: { $ref: '#/components/schemas/Request' }
   *       400:
   *         description: CURRENT_USER_REQUIRED, INVALID_REQUEST_ID, REJECTION_COMMENT_REQUIRED (empty or missing comment), or INVALID_JSON (malformed body).
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/Error' }
   *       401: { $ref: '#/components/responses/Unauthorized' }
   *       403:
   *         description: The current user can view the request but may not decide it (REQUEST_FORBIDDEN, "You cannot decide this request.").
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/Error' }
   *       404:
   *         description: The request does not exist or the current user cannot view it (REQUEST_NOT_FOUND).
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/Error' }
   *       409:
   *         description: The request is not Submitted (REQUEST_NOT_DECIDABLE).
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/Error' }
   */
  app.post("/api/requests/:id/reject", (request, response, next) => {
    try {
      const user = getCurrentUser(db, request.query.currentUserId);
      response.json({ data: rejectRequest(db, user, request.params.id, request.body?.comment) });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @openapi
   * /api/requests/{id}/comments:
   *   get:
   *     summary: List a request's comments
   *     description: Anyone who can view the request can read its comments. Oldest first.
   *     tags: [Comments]
   *     parameters:
   *       - $ref: '#/components/parameters/RequestId'
   *       - $ref: '#/components/parameters/CurrentUserId'
   *     responses:
   *       200:
   *         description: The request's comments.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: array
   *                   items: { $ref: '#/components/schemas/Comment' }
   *       400: { $ref: '#/components/responses/BadRequest' }
   *       401: { $ref: '#/components/responses/Unauthorized' }
   *       403:
   *         description: The current user cannot view this request (REQUEST_FORBIDDEN, "You cannot view this request.").
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/Error' }
   *       404: { $ref: '#/components/responses/NotFound' }
   *   post:
   *     summary: Add a comment to a request
   *     description: Anyone who can view the request can comment, at any status. The text is trimmed and must not be empty. The request itself is not changed.
   *     tags: [Comments]
   *     parameters:
   *       - $ref: '#/components/parameters/RequestId'
   *       - $ref: '#/components/parameters/CurrentUserId'
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               text: { type: string }
   *     responses:
   *       201:
   *         description: The created comment.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data: { $ref: '#/components/schemas/Comment' }
   *       400:
   *         description: CURRENT_USER_REQUIRED, INVALID_REQUEST_ID, COMMENT_TEXT_REQUIRED (empty or missing text), or INVALID_JSON (malformed body).
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/Error' }
   *       401: { $ref: '#/components/responses/Unauthorized' }
   *       403:
   *         description: The current user cannot view this request (REQUEST_FORBIDDEN, "You cannot view this request.").
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/Error' }
   *       404: { $ref: '#/components/responses/NotFound' }
   */
  app.get("/api/requests/:id/comments", (request, response, next) => {
    try {
      const user = getCurrentUser(db, request.query.currentUserId);
      response.json({ data: listComments(db, user, request.params.id) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/requests/:id/comments", (request, response, next) => {
    try {
      const user = getCurrentUser(db, request.query.currentUserId);
      response.status(201).json({ data: addComment(db, user, request.params.id, request.body?.text) });
    } catch (error) {
      next(error);
    }
  });

  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get("/{*path}", (_request, response) => {
      response.sendFile(path.join(clientDist, "index.html"));
    });
  }

  app.use((error, _request, response, _next) => {
    if (error instanceof SyntaxError && "body" in error) {
      return response.status(400).json(errorResponse({
        code: "INVALID_JSON",
        message: "The request body contains invalid JSON.",
      }));
    }
    const status = Number.isInteger(error.status) ? error.status : 500;
    if (status >= 500) console.error(error);
    return response.status(status).json(errorResponse(error));
  });

  return app;
}
