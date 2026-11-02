import StatusBadge from "./StatusBadge.jsx";

export default function RequestList({ requests, loading, selectedId, onSelect }) {
  return (
    <section className="panel request-panel" aria-labelledby="request-list-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Queue</p>
          <h2 id="request-list-title">Requests</h2>
        </div>
        <span className="count">{requests.length}</span>
      </div>

      {loading ? (
        <p className="empty-state">Loading requests…</p>
      ) : requests.length === 0 ? (
        <p className="empty-state">No requests are available for this user.</p>
      ) : (
        <div className="request-list">
          {requests.map((request) => (
            <button
              className={`request-card ${selectedId === request.id ? "is-selected" : ""}`}
              key={request.id}
              onClick={() => onSelect(request.id)}
              type="button"
            >
              <span className="request-card-topline">
                <span className="request-id">REQ-{request.id}</span>
                <StatusBadge status={request.status} />
              </span>
              <strong>{request.title}</strong>
              <span className="request-meta">
                {request.categoryName} · {request.priority} priority
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
