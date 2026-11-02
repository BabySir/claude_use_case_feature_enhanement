import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import RequestDetails from "./RequestDetails.jsx";

afterEach(cleanup);

const baseRequest = {
  id: 101,
  title: "Additional monitor",
  description: "A second monitor is needed.",
  priority: "Medium",
  status: "Submitted",
  reviewerComment: null,
  createdAt: "2026-09-15T09:20:00Z",
  updatedAt: "2026-09-15T09:20:00Z",
  categoryId: 1,
  categoryName: "Equipment",
  requesterId: 1,
  requesterName: "Maya Nair",
  assignedReviewerId: 3,
  assignedReviewerName: "Priya Menon",
};

test("AC-8: shows the Cancel button when the viewer is the requester and the request is submitted", () => {
  render(<RequestDetails request={baseRequest} currentUserId={1} onCancel={() => {}} />);
  expect(screen.getByRole("button", { name: "Cancel request" })).toBeInTheDocument();
});

test("AC-8: clicking Cancel request calls the onCancel callback", () => {
  const onCancel = vi.fn();
  render(<RequestDetails request={baseRequest} currentUserId={1} onCancel={onCancel} />);
  fireEvent.click(screen.getByRole("button", { name: "Cancel request" }));
  expect(onCancel).toHaveBeenCalledOnce();
});

test("AC-9: hides the Cancel button when the viewer is not the requester", () => {
  render(<RequestDetails request={baseRequest} currentUserId={2} onCancel={() => {}} />);
  expect(screen.queryByRole("button", { name: "Cancel request" })).not.toBeInTheDocument();
});

test("AC-9: hides the Cancel button when the request is not submitted", () => {
  render(
    <RequestDetails
      request={{ ...baseRequest, status: "Approved" }}
      currentUserId={1}
      onCancel={() => {}}
    />,
  );
  expect(screen.queryByRole("button", { name: "Cancel request" })).not.toBeInTheDocument();
});

test("AC-10: shows Approve and Reject controls when the viewer is the assigned reviewer and the request is submitted", () => {
  render(<RequestDetails request={baseRequest} currentUserId={3} currentUserRole="reviewer" onApprove={() => {}} onReject={() => {}} />);
  expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
});

test("AC-10: clicking Approve calls the onApprove callback", () => {
  const onApprove = vi.fn();
  render(<RequestDetails request={baseRequest} currentUserId={3} currentUserRole="reviewer" onApprove={onApprove} onReject={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: "Approve" }));
  expect(onApprove).toHaveBeenCalledOnce();
});

test("AC-10: the Reject button is disabled until a comment is entered, then calls onReject with it", () => {
  const onReject = vi.fn();
  render(<RequestDetails request={baseRequest} currentUserId={3} currentUserRole="reviewer" onApprove={() => {}} onReject={onReject} />);

  const rejectButton = screen.getByRole("button", { name: "Reject" });
  expect(rejectButton).toBeDisabled();

  fireEvent.change(screen.getByLabelText("Reviewer comment (required to reject)"), {
    target: { value: "Needs more detail." },
  });
  expect(rejectButton).not.toBeDisabled();

  fireEvent.click(rejectButton);
  expect(onReject).toHaveBeenCalledWith("Needs more detail.");
});

test("AC-11: hides Approve/Reject controls when the viewer is not the assigned reviewer", () => {
  render(<RequestDetails request={baseRequest} currentUserId={5} onApprove={() => {}} onReject={() => {}} />);
  expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
});

test("AC-11: hides Approve/Reject controls when the request is not submitted", () => {
  render(
    <RequestDetails
      request={{ ...baseRequest, status: "Approved" }}
      currentUserId={3}
      currentUserRole="reviewer"
      onApprove={() => {}}
      onReject={() => {}}
    />,
  );
  expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
});

const comments = [
  {
    id: 1, requestId: 101, authorId: 1, authorName: "Maya Nair",
    body: "Any update on delivery?", createdAt: "2026-09-16T09:00:00Z",
  },
  {
    id: 2, requestId: 101, authorId: 3, authorName: "Priya Menon",
    body: "Checking with the supplier.", createdAt: "2026-09-16T10:00:00Z",
  },
];

test("CMT-30/32: lists comments in the given order with author and timestamp", () => {
  render(<RequestDetails request={baseRequest} comments={comments} currentUserId={1} />);

  const items = within(screen.getByRole("region", { name: "Comments" })).getAllByRole("listitem");
  expect(items).toHaveLength(2);
  expect(items[0]).toHaveTextContent("Maya Nair");
  expect(items[0]).toHaveTextContent("Any update on delivery?");
  expect(items[1]).toHaveTextContent("Priya Menon");
  expect(items[1]).toHaveTextContent("Checking with the supplier.");

  const time = items[0].querySelector("time");
  expect(time).toHaveAttribute("dateTime", "2026-09-16T09:00:00Z");
  expect(time.textContent).toMatch(/2026/);
});

test("CMT-13: the Add comment button is disabled until non-blank text is entered, then submits and clears", async () => {
  const onAddComment = vi.fn(async () => {});
  render(<RequestDetails request={baseRequest} currentUserId={1} onAddComment={onAddComment} />);

  const button = screen.getByRole("button", { name: "Add comment" });
  const textarea = screen.getByLabelText("Add comment");
  expect(button).toBeDisabled();

  fireEvent.change(textarea, { target: { value: "   " } });
  expect(button).toBeDisabled();

  fireEvent.change(textarea, { target: { value: "Any update?" } });
  expect(button).not.toBeDisabled();

  fireEvent.click(button);
  expect(onAddComment).toHaveBeenCalledWith("Any update?");
  await waitFor(() => expect(textarea).toHaveValue(""));
});

test("CMT-43: the reviewer comment stays separate from the comments list", () => {
  render(
    <RequestDetails
      request={{ ...baseRequest, status: "Rejected", reviewerComment: "Please attach the assessment." }}
      comments={comments}
      currentUserId={1}
    />,
  );

  expect(screen.getByText("Reviewer comment")).toBeInTheDocument();
  const commentsRegion = screen.getByRole("region", { name: "Comments" });
  expect(within(commentsRegion).queryByText("Please attach the assessment.")).not.toBeInTheDocument();
  expect(within(commentsRegion).getByText("Checking with the supplier.")).toBeInTheDocument();
});

function detailValue(label) {
  return screen.getByText(label, { selector: "dt" }).nextElementSibling.textContent;
}

test("AR-52: hides Approve/Reject controls from an assigned user without the reviewer role", () => {
  for (const role of ["employee", "admin"]) {
    render(
      <RequestDetails
        request={baseRequest}
        currentUserId={3}
        currentUserRole={role}
        onApprove={() => {}}
        onReject={() => {}}
      />,
    );
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
    cleanup();
  }
});

test("AR-52: hides Approve/Reject controls from an assigned reviewer who raised the request", () => {
  render(
    <RequestDetails
      request={{ ...baseRequest, requesterId: 3, requesterName: "Priya Menon" }}
      currentUserId={3}
      currentUserRole="reviewer"
      onApprove={() => {}}
      onReject={() => {}}
    />,
  );
  expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
});

test("AR-53: shows who decided a request and when", () => {
  render(
    <RequestDetails
      request={{
        ...baseRequest,
        status: "Approved",
        decidedById: 3,
        decidedByName: "Priya Menon",
        decidedAt: "2026-09-16T12:00:00Z",
      }}
      currentUserId={1}
    />,
  );
  expect(detailValue("Decided by")).toBe("Priya Menon");
  expect(detailValue("Decided on")).toMatch(/2026/);
  expect(detailValue("Decided on")).not.toBe("Not recorded");
});

test("AR-55: shows Not recorded for a decision made before decisions were recorded", () => {
  for (const status of ["Approved", "Rejected"]) {
    render(
      <RequestDetails
        request={{ ...baseRequest, status, decidedById: null, decidedByName: null, decidedAt: null }}
        currentUserId={1}
      />,
    );
    expect(detailValue("Decided by")).toBe("Not recorded");
    expect(detailValue("Decided on")).toBe("Not recorded");
    cleanup();
  }
});

test("AR-56: shows no decision rows for a request that has not been decided", () => {
  for (const status of ["Submitted", "Draft", "Cancelled"]) {
    render(<RequestDetails request={{ ...baseRequest, status }} currentUserId={1} />);
    expect(screen.queryByText("Decided by")).not.toBeInTheDocument();
    expect(screen.queryByText("Decided on")).not.toBeInTheDocument();
    cleanup();
  }
});
