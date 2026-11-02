import { useEffect, useState } from "react";
import StatusBadge from "./StatusBadge.jsx";

export default function RequestDetails({
  request,
  comments = [],
  currentUserId,
  currentUserRole,
  onCancel,
  onApprove,
  onReject,
  onAddComment,
}) {
  const [rejectComment, setRejectComment] = useState("");
  const [commentText, setCommentText] = useState("");

  useEffect(() => {
    setRejectComment("");
    setCommentText("");
  }, [request?.id, request?.status]);

  async function submitComment() {
    try {
      await onAddComment(commentText);
      setCommentText("");
    } catch {
      // The error is shown in the page banner; keep the text so it can be retried.
    }
  }

  if (!request) {
    return (
      <section className="panel detail-panel empty-detail" aria-live="polite">
        <div className="empty-icon" aria-hidden="true">↗</div>
        <h2>Select a request</h2>
        <p>Choose a request from the queue to see its complete details.</p>
      </section>
    );
  }

  return (
    <section className="panel detail-panel" aria-labelledby="request-detail-title">
      <div className="detail-heading">
        <div>
          <p className="eyebrow">REQ-{request.id}</p>
          <h2 id="request-detail-title">{request.title}</h2>
        </div>
        <StatusBadge status={request.status} />
      </div>

      <p className="description">{request.description}</p>

      <dl className="detail-grid">
        <Detail label="Category" value={request.categoryName} />
        <Detail label="Priority" value={request.priority} />
        <Detail label="Requested by" value={request.requesterName} />
        <Detail label="Assigned reviewer" value={request.assignedReviewerName ?? "Not assigned"} />
        <Detail label="Created" value={formatDate(request.createdAt)} />
        <Detail label="Last updated" value={formatDate(request.updatedAt)} />
        {(request.status === "Approved" || request.status === "Rejected") && (
          <>
            <Detail label="Decided by" value={request.decidedByName ?? "Not recorded"} />
            <Detail
              label="Decided on"
              value={request.decidedAt ? formatDate(request.decidedAt) : "Not recorded"}
            />
          </>
        )}
      </dl>

      {request.reviewerComment && (
        <div className="review-note">
          <strong>Reviewer comment</strong>
          <p>{request.reviewerComment}</p>
        </div>
      )}

      {request.status === "Submitted" && request.requesterId === currentUserId && (
        <button type="button" className="cancel-request" onClick={onCancel}>
          Cancel request
        </button>
      )}

      {request.status === "Submitted"
        && request.assignedReviewerId === currentUserId
        && currentUserRole === "reviewer"
        && request.requesterId !== currentUserId && (
        <div className="decision-controls">
          <button type="button" className="approve-request" onClick={onApprove}>
            Approve
          </button>

          <div className="reject-control">
            <label htmlFor="reject-comment">Reviewer comment (required to reject)</label>
            <textarea
              id="reject-comment"
              value={rejectComment}
              onChange={(event) => setRejectComment(event.target.value)}
            />
            <button
              type="button"
              className="reject-request"
              disabled={!rejectComment.trim()}
              onClick={() => onReject(rejectComment)}
            >
              Reject
            </button>
          </div>
        </div>
      )}

      <section className="comments" aria-labelledby="comments-title">
        <h3 id="comments-title">Comments</h3>
        {comments.length === 0 ? (
          <p className="comments-empty">No comments yet.</p>
        ) : (
          <ol className="comment-list">
            {comments.map((comment) => (
              <li key={comment.id} className="comment">
                <div className="comment-meta">
                  <strong>{comment.authorName}</strong>
                  <time dateTime={comment.createdAt}>{formatDateTime(comment.createdAt)}</time>
                </div>
                <p className="comment-body">{comment.body}</p>
              </li>
            ))}
          </ol>
        )}

        <div className="comment-form">
          <label htmlFor="comment-text">Add comment</label>
          <textarea
            id="comment-text"
            value={commentText}
            onChange={(event) => setCommentText(event.target.value)}
          />
          <button
            type="button"
            className="add-comment"
            disabled={!commentText.trim()}
            onClick={submitComment}
          >
            Add comment
          </button>
        </div>
      </section>
    </section>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
