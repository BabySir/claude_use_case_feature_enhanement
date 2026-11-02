import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import App from "./App.jsx";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test("loads the employee request workspace", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url) => {
    if (url === "/api/users") {
      return jsonResponse({
        data: [{ id: 1, name: "Maya Nair", email: "maya@example.test", role: "employee" }],
      });
    }
    if (url === "/api/requests?currentUserId=1") {
      return jsonResponse({
        data: [{
          id: 101,
          title: "Additional monitor",
          categoryName: "Equipment",
          priority: "Medium",
          status: "Submitted",
        }],
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  }));

  render(<App />);

  expect(await screen.findByRole("heading", { name: "My requests" })).toBeInTheDocument();
  expect(await screen.findByText("Additional monitor")).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText("1")).toBeInTheDocument());
});

test("CMT-22/33: shows a request's comments, appends a new one, and clears them on user switch", async () => {
  const request = {
    id: 101,
    title: "Additional monitor",
    description: "A second monitor is needed.",
    categoryName: "Equipment",
    priority: "Medium",
    status: "Submitted",
    reviewerComment: null,
    createdAt: "2026-09-15T09:20:00Z",
    updatedAt: "2026-09-15T09:20:00Z",
    requesterId: 1,
    requesterName: "Maya Nair",
    assignedReviewerId: 3,
    assignedReviewerName: "Priya Menon",
  };
  const existingComment = {
    id: 1, requestId: 101, authorId: 3, authorName: "Priya Menon",
    body: "Checking with the supplier.", createdAt: "2026-09-16T10:00:00Z",
  };
  const newComment = {
    id: 2, requestId: 101, authorId: 1, authorName: "Maya Nair",
    body: "Thanks!", createdAt: "2026-09-16T11:00:00Z",
  };
  const fetchMock = vi.fn(async (url, options = {}) => {
    if (url === "/api/users") {
      return jsonResponse({
        data: [
          { id: 1, name: "Maya Nair", email: "maya@example.test", role: "employee" },
          { id: 2, name: "Rahul Shah", email: "rahul@example.test", role: "employee" },
        ],
      });
    }
    if (url === "/api/requests?currentUserId=1") return jsonResponse({ data: [request] });
    if (url === "/api/requests?currentUserId=2") return jsonResponse({ data: [] });
    if (url === "/api/requests/101?currentUserId=1") return jsonResponse({ data: request });
    if (url === "/api/requests/101/comments?currentUserId=1" && options.method === "POST") {
      expect(JSON.parse(options.body)).toEqual({ text: "Thanks!" });
      return jsonResponse({ data: newComment }, 201);
    }
    if (url === "/api/requests/101/comments?currentUserId=1") {
      return jsonResponse({ data: [existingComment] });
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);

  render(<App />);

  fireEvent.click(await screen.findByRole("button", { name: /Additional monitor/ }));
  expect(await screen.findByText("Checking with the supplier.")).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Add comment"), { target: { value: "Thanks!" } });
  fireEvent.click(screen.getByRole("button", { name: "Add comment" }));
  expect(await screen.findByText("Thanks!")).toBeInTheDocument();
  expect(screen.getByLabelText("Add comment")).toHaveValue("");

  const commentGets = fetchMock.mock.calls.filter(
    ([url, options]) => url.includes("/comments") && options?.method !== "POST",
  );
  expect(commentGets).toHaveLength(1);

  fireEvent.change(screen.getByLabelText("Current user"), { target: { value: "2" } });
  await waitFor(() => expect(screen.queryByText("Checking with the supplier.")).not.toBeInTheDocument());
  expect(screen.queryByText("Thanks!")).not.toBeInTheDocument();
});

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}
