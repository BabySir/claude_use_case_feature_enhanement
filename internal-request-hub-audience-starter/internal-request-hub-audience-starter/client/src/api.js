async function requestJson(url, { method = "GET", body } = {}) {
  const response = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const responseBody = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(responseBody?.error?.message ?? `Request failed with status ${response.status}.`);
  }
  return responseBody;
}

export async function loadUsers() {
  return (await requestJson("/api/users")).data;
}

export async function loadRequests(currentUserId) {
  return (await requestJson(`/api/requests?currentUserId=${currentUserId}`)).data;
}

export async function loadRequest(requestId, currentUserId) {
  return (await requestJson(`/api/requests/${requestId}?currentUserId=${currentUserId}`)).data;
}

export async function cancelRequest(requestId, currentUserId) {
  return (await requestJson(
    `/api/requests/${requestId}/cancel?currentUserId=${currentUserId}`,
    { method: "POST" },
  )).data;
}

export async function approveRequest(requestId, currentUserId) {
  return (await requestJson(
    `/api/requests/${requestId}/approve?currentUserId=${currentUserId}`,
    { method: "POST" },
  )).data;
}

export async function rejectRequest(requestId, currentUserId, comment) {
  return (await requestJson(
    `/api/requests/${requestId}/reject?currentUserId=${currentUserId}`,
    { method: "POST", body: { comment } },
  )).data;
}

export async function loadComments(requestId, currentUserId) {
  return (await requestJson(`/api/requests/${requestId}/comments?currentUserId=${currentUserId}`)).data;
}

export async function addComment(requestId, currentUserId, text) {
  return (await requestJson(
    `/api/requests/${requestId}/comments?currentUserId=${currentUserId}`,
    { method: "POST", body: { text } },
  )).data;
}
