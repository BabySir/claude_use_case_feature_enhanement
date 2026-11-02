import { HttpError } from "./http-errors.js";

export function getCurrentUser(db, rawUserId) {
  const userId = Number(rawUserId);
  if (!Number.isInteger(userId)) {
    throw new HttpError(400, "CURRENT_USER_REQUIRED", "Select a current user.");
  }

  const user = db.prepare(`
    SELECT id, name, email, role, active
    FROM users
    WHERE id = ?
  `).get(userId);

  if (!user || !user.active) {
    throw new HttpError(401, "INVALID_CURRENT_USER", "The selected user is unavailable.");
  }

  return { ...user, active: Boolean(user.active) };
}
